"""
main.py
Entry point for the Procurement Agent Squadron.
Run: python main.py
"""
import asyncio
import logging
import signal

from config.logging_config import setup_logging
from config.settings import settings
from orchestrator.orchestrator import ProcurementOrchestrator, TaskIntent
from state.models import PriorityLevel
from tools.erp_tool import ERPTool
from tools.email_tool import EmailTool, DocumentTool
from tools.market_data_tool import MarketDataTool
from tools.tool_registry import get_registry


def bootstrap_tools() -> None:
    """Register all tools into the global registry."""
    registry = get_registry()
    registry.register(ERPTool(settings.erp_base_url, settings.erp_api_key, settings.erp_mock_mode))
    registry.register(EmailTool(settings.smtp_host, settings.smtp_port, settings.email_from))
    registry.register(DocumentTool())
    registry.register(MarketDataTool())
    logging.getLogger(__name__).info("Tools bootstrapped: %d registered", len(registry._tools))


async def run_service() -> None:
    """Run the orchestrator as a persistent background service."""
    log = logging.getLogger(__name__)
    orch = ProcurementOrchestrator()

    # Graceful shutdown on SIGTERM / SIGINT (Docker sends SIGTERM on stop)
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(_shutdown(orch, log)))

    log.info("Procurement Agent Squadron starting...")

    # Submit an initial inventory scan so agents have something to do on startup
    asyncio.create_task(_submit_initial_tasks(orch, log))

    # start() runs the dispatch + monitoring loops forever
    await orch.start()


async def _submit_initial_tasks(orch: ProcurementOrchestrator, log: logging.Logger) -> None:
    await asyncio.sleep(2)  # let the orchestrator fully initialise first
    trace = await orch.submit(
        intent=TaskIntent.SCAN_INVENTORY,
        payload={},
        priority=PriorityLevel.LOW,
    )
    log.info("Initial inventory scan queued | trace=%s", trace)


async def _shutdown(orch: ProcurementOrchestrator, log: logging.Logger) -> None:
    log.info("Shutdown signal received — stopping orchestrator")
    await orch.stop()


if __name__ == "__main__":
    setup_logging(settings.log_level)
    bootstrap_tools()
    asyncio.run(run_service())
