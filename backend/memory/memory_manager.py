"""
memory/memory_manager.py
Unified memory API — Ch.8 Memory Management.

Short-term: per-agent context window manager.
Long-term: Azure AI Search vector store for RAG (Ch.14).
Inspired by Google ADK Session/State/MemoryService pattern.
"""

from __future__ import annotations

import asyncio
import json
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Short-Term Memory (Context Window Management)
# ---------------------------------------------------------------------------

@dataclass
class Message:
    role: str           # "user" | "assistant" | "tool" | "system"
    content: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


class ShortTermMemory:
    """
    Sliding-window context manager for a single agent session.
    Prevents context overflow while keeping the most relevant turns.
    """

    def __init__(self, max_tokens: int = 8000, system_prompt: str = "") -> None:
        self._messages: List[Message] = []
        self._max_tokens = max_tokens
        self._system_prompt = system_prompt
        self._token_estimate = 0

    @property
    def system_prompt(self) -> str:
        return self._system_prompt

    def add_message(self, role: str, content: str, **metadata: Any) -> None:
        msg = Message(role=role, content=content, metadata=metadata)
        self._messages.append(msg)
        self._token_estimate += self._estimate_tokens(content)
        self._trim_if_needed()

    def add_tool_result(self, tool_name: str, result: Any) -> None:
        content = json.dumps(result, default=str)
        self.add_message("tool", content, tool_name=tool_name)

    def get_messages(self) -> List[Dict[str, str]]:
        """Return messages in the format expected by the LLM API."""
        return [{"role": m.role, "content": m.content} for m in self._messages]

    def clear(self) -> None:
        self._messages.clear()
        self._token_estimate = 0

    def snapshot(self) -> List[Dict]:
        return [
            {
                "role": m.role,
                "content": m.content,
                "timestamp": m.timestamp.isoformat(),
                "metadata": m.metadata,
            }
            for m in self._messages
        ]

    # ------------------------------------------------------------------

    def _estimate_tokens(self, text: str) -> int:
        # Rough: 4 chars ≈ 1 token
        return max(1, len(text) // 4)

    def _trim_if_needed(self) -> None:
        """Drop oldest non-system messages when approaching token limit."""
        while self._token_estimate > self._max_tokens and len(self._messages) > 1:
            removed = self._messages.pop(0)
            self._token_estimate -= self._estimate_tokens(removed.content)
            logger.debug("ShortTermMemory: trimmed oldest message (role=%s)", removed.role)


# ---------------------------------------------------------------------------
# Long-Term Memory (Vector Store / RAG)
# ---------------------------------------------------------------------------

class LongTermMemoryBase(ABC):
    """Abstract interface for long-term semantic memory — Ch.14 RAG."""

    @abstractmethod
    async def upsert(self, doc_id: str, content: str, metadata: Dict[str, Any]) -> None:
        """Store or update a document in the vector store."""

    @abstractmethod
    async def search(
        self, query: str, top_k: int = 5, filter_metadata: Optional[Dict] = None
    ) -> List[Dict[str, Any]]:
        """Semantic search — returns list of {content, score, metadata}."""

    @abstractmethod
    async def delete(self, doc_id: str) -> None:
        """Remove a document."""


class InMemoryVectorStore(LongTermMemoryBase):
    """
    Simple in-memory fallback (development / testing).
    Uses cosine similarity on TF-IDF-like bag-of-words (no external deps).
    """

    def __init__(self) -> None:
        self._store: Dict[str, Dict[str, Any]] = {}

    async def upsert(self, doc_id: str, content: str, metadata: Dict[str, Any]) -> None:
        self._store[doc_id] = {
            "content": content,
            "metadata": metadata,
            "words": set(content.lower().split()),
        }

    async def search(
        self, query: str, top_k: int = 5, filter_metadata: Optional[Dict] = None
    ) -> List[Dict[str, Any]]:
        query_words = set(query.lower().split())
        results = []
        for doc_id, doc in self._store.items():
            if filter_metadata:
                if not all(doc["metadata"].get(k) == v for k, v in filter_metadata.items()):
                    continue
            score = len(query_words & doc["words"]) / max(len(query_words), 1)
            results.append({"doc_id": doc_id, "content": doc["content"],
                             "score": score, "metadata": doc["metadata"]})
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]

    async def delete(self, doc_id: str) -> None:
        self._store.pop(doc_id, None)


class ChromaVectorStore(LongTermMemoryBase):
    """
    Production vector store backed by ChromaDB (open-source).
    Falls back to InMemoryVectorStore if ChromaDB is unreachable.
    """

    def __init__(self, host: str, port: int, collection_name: str) -> None:
        self._host = host
        self._port = port
        self._collection_name = collection_name
        self._collection = None
        self._fallback = InMemoryVectorStore()

    async def _get_collection(self):
        if self._collection is None:
            try:
                import chromadb  # type: ignore
                loop = asyncio.get_event_loop()
                client = await loop.run_in_executor(
                    None,
                    lambda: chromadb.HttpClient(host=self._host, port=self._port),
                )
                self._collection = await loop.run_in_executor(
                    None,
                    lambda: client.get_or_create_collection(self._collection_name),
                )
                logger.info("ChromaDB collection ready: %s", self._collection_name)
            except Exception as exc:
                logger.warning("ChromaDB unavailable, using in-memory fallback: %s", exc)
        return self._collection

    async def upsert(self, doc_id: str, content: str, metadata: Dict[str, Any]) -> None:
        collection = await self._get_collection()
        if collection:
            try:
                loop = asyncio.get_event_loop()
                clean_meta = {k: str(v) for k, v in metadata.items()}
                await loop.run_in_executor(
                    None,
                    lambda: collection.upsert(
                        ids=[doc_id],
                        documents=[content],
                        metadatas=[clean_meta],
                    ),
                )
                return
            except Exception as exc:
                logger.warning("ChromaDB upsert failed, using fallback: %s", exc)
        await self._fallback.upsert(doc_id, content, metadata)

    async def search(
        self, query: str, top_k: int = 5, filter_metadata: Optional[Dict] = None
    ) -> List[Dict[str, Any]]:
        collection = await self._get_collection()
        if collection:
            try:
                loop = asyncio.get_event_loop()
                where = {k: str(v) for k, v in filter_metadata.items()} if filter_metadata else None
                results = await loop.run_in_executor(
                    None,
                    lambda: collection.query(
                        query_texts=[query],
                        n_results=top_k,
                        where=where,
                    ),
                )
                return [
                    {
                        "doc_id": results["ids"][0][i],
                        "content": results["documents"][0][i],
                        "score": 1 - results["distances"][0][i] if results.get("distances") else 0,
                        "metadata": results["metadatas"][0][i] if results.get("metadatas") else {},
                    }
                    for i in range(len(results["ids"][0]))
                ]
            except Exception as exc:
                logger.warning("ChromaDB search failed, using fallback: %s", exc)
        return await self._fallback.search(query, top_k, filter_metadata)

    async def delete(self, doc_id: str) -> None:
        collection = await self._get_collection()
        if collection:
            try:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, lambda: collection.delete(ids=[doc_id]))
                return
            except Exception as exc:
                logger.warning("ChromaDB delete failed: %s", exc)
        await self._fallback.delete(doc_id)


# ---------------------------------------------------------------------------
# Unified Memory Manager
# ---------------------------------------------------------------------------

class AgentMemoryManager:
    """
    Per-agent memory facade combining short-term + long-term memory.
    ADK-inspired: Session (short-term) + MemoryService (long-term).
    """

    def __init__(
        self,
        agent_id: str,
        system_prompt: str,
        long_term: Optional[LongTermMemoryBase] = None,
        max_context_tokens: int = 8000,
    ) -> None:
        self.agent_id = agent_id
        self.short_term = ShortTermMemory(max_context_tokens, system_prompt)
        self.long_term: LongTermMemoryBase = long_term or InMemoryVectorStore()

    @property
    def system_prompt(self) -> str:
        return self.short_term.system_prompt

    # ------------------------------------------------------------------
    # Short-term helpers
    # ------------------------------------------------------------------

    def remember(self, role: str, content: str, **meta: Any) -> None:
        self.short_term.add_message(role, content, **meta)

    def get_context(self) -> List[Dict[str, str]]:
        return self.short_term.get_messages()

    def reset_session(self) -> None:
        self.short_term.clear()

    # ------------------------------------------------------------------
    # Long-term helpers (async)
    # ------------------------------------------------------------------

    async def store(self, doc_id: str, content: str, **metadata: Any) -> None:
        await self.long_term.upsert(
            doc_id, content, {"agent_id": self.agent_id, **metadata}
        )

    async def recall(
        self, query: str, top_k: int = 5, **filter_meta: Any
    ) -> List[Dict[str, Any]]:
        """Semantic recall — returns relevant past knowledge for RAG."""
        return await self.long_term.search(
            query, top_k, filter_metadata=filter_meta or None
        )

    async def recall_as_context(self, query: str, top_k: int = 3) -> str:
        """Format recalled docs as a context block for injection into prompts."""
        docs = await self.recall(query, top_k)
        if not docs:
            return ""
        lines = ["### Relevant knowledge from memory:"]
        for i, doc in enumerate(docs, 1):
            lines.append(f"{i}. {doc['content'][:400]}")
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def build_memory_manager(agent_id: str, system_prompt: str) -> AgentMemoryManager:
    from config.settings import settings
    collection_name = f"{settings.chroma_collection_prefix}-{agent_id}"
    store: LongTermMemoryBase = ChromaVectorStore(
        host=settings.chroma_host,
        port=settings.chroma_port,
        collection_name=collection_name,
    )
    return AgentMemoryManager(
        agent_id=agent_id,
        system_prompt=system_prompt,
        long_term=store,
        max_context_tokens=settings.models.primary_max_tokens,
    )
