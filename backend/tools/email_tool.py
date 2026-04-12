"""
tools/email_tool.py + document_tool.py
Email dispatch and document generation tools — Ch.5 Tool Use.
"""

from __future__ import annotations

import json
import logging
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional

from tools.tool_registry import BaseTool, ToolDefinition, ToolParameter

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Email Tool
# ---------------------------------------------------------------------------

class EmailTool(BaseTool):

    definition = ToolDefinition(
        name="email",
        description=(
            "Send emails to vendors, internal stakeholders, or the vendor portal. "
            "Supports RFQ distribution, award notifications, PO transmission, "
            "and performance feedback."
        ),
        parameters=[
            ToolParameter("to", "array", "List of recipient email addresses"),
            ToolParameter("subject", "string", "Email subject line"),
            ToolParameter("body", "string", "Email body (plain text or HTML)"),
            ToolParameter("cc", "array", "CC recipients", required=False),
            ToolParameter("attachments", "array",
                          "List of {filename, content_b64} dicts", required=False),
            ToolParameter("email_type", "string", "Email category for audit",
                          enum=["rfq", "award", "po", "rejection", "feedback",
                                "contract_renewal", "general"],
                          required=False),
        ],
        tags=["email", "communication", "vendor"],
    )

    def __init__(self, smtp_host: str, smtp_port: int,
                 from_addr: str, mock_mode: bool = True) -> None:
        super().__init__(max_retries=3, backoff=1.0)
        self._host = smtp_host
        self._port = smtp_port
        self._from = from_addr
        self._mock = mock_mode
        self._sent_log: List[Dict] = []  # for testing inspection

    async def _execute(
        self,
        to: List[str],
        subject: str,
        body: str,
        cc: Optional[List[str]] = None,
        attachments: Optional[List[Dict]] = None,
        email_type: str = "general",
    ) -> Dict[str, Any]:
        if self._mock:
            record = {
                "sent_at": datetime.utcnow().isoformat(),
                "to": to, "cc": cc or [],
                "subject": subject, "email_type": email_type,
                "status": "mock_sent",
            }
            self._sent_log.append(record)
            logger.info("MOCK EMAIL | to=%s | subject=%s | type=%s", to, subject, email_type)
            return record

        msg = MIMEMultipart()
        msg["From"] = self._from
        msg["To"] = ", ".join(to)
        msg["Subject"] = subject
        if cc:
            msg["Cc"] = ", ".join(cc)
        msg.attach(MIMEText(body, "html" if "<html" in body.lower() else "plain"))

        try:
            with smtplib.SMTP(self._host, self._port) as server:
                server.sendmail(self._from, to + (cc or []), msg.as_string())
            return {"status": "sent", "to": to, "subject": subject}
        except Exception as exc:
            raise RuntimeError(f"SMTP failed: {exc}") from exc

    @property
    def sent_log(self) -> List[Dict]:
        return list(self._sent_log)


# ---------------------------------------------------------------------------
# Document Tool
# ---------------------------------------------------------------------------

class DocumentTool(BaseTool):
    """
    Generates structured procurement documents (RFQ, PO, contract, scorecard).
    In production, integrates with a template service or Azure Document Intelligence.
    """

    definition = ToolDefinition(
        name="document",
        description=(
            "Generate procurement documents from structured data. "
            "Supports RFQ specifications, purchase orders, contract drafts, "
            "vendor scorecards, and award letters."
        ),
        parameters=[
            ToolParameter("document_type", "string", "Type of document to generate",
                          enum=["rfq", "po", "contract", "award_letter",
                                "rejection_letter", "scorecard", "amendment"]),
            ToolParameter("data", "object", "Structured data to populate the template"),
            ToolParameter("output_format", "string", "Output format",
                          enum=["json", "html", "text"], required=False),
        ],
        tags=["document", "generation", "template"],
    )

    def __init__(self) -> None:
        super().__init__(max_retries=2)

    async def _execute(
        self,
        document_type: str,
        data: Dict[str, Any],
        output_format: str = "json",
    ) -> Dict[str, Any]:
        generator = {
            "rfq":             self._gen_rfq,
            "po":              self._gen_po,
            "contract":        self._gen_contract,
            "award_letter":    self._gen_award_letter,
            "rejection_letter": self._gen_rejection_letter,
            "scorecard":       self._gen_scorecard,
            "amendment":       self._gen_amendment,
        }.get(document_type)

        if not generator:
            raise ValueError(f"Unknown document type: {document_type}")

        content = generator(data)
        return {
            "document_type": document_type,
            "generated_at": datetime.utcnow().isoformat(),
            "format": output_format,
            "content": content,
            "reference": data.get("reference_number", "N/A"),
        }

    def _gen_rfq(self, d: Dict) -> str:
        items = "\n".join(
            f"  Line {i['line_no']}: {i['description']} — Qty {i['quantity']} {i['unit_of_measure']}"
            for i in d.get("items", [])
        )
        return f"""
REQUEST FOR QUOTATION
=====================
RFQ Number    : {d.get('rfq_number', 'TBD')}
Date Issued   : {datetime.utcnow().strftime('%Y-%m-%d')}
Category      : {d.get('category', '')}
Submission By : {d.get('submission_deadline', '')}

SCOPE OF SUPPLY:
{items}

Please submit your best commercial and technical offer by the deadline above.
All submissions must comply with Nigerian Content requirements.

Issued by: Procurement Agent Squadron — Seplat Energy
"""

    def _gen_po(self, d: Dict) -> str:
        lines = "\n".join(
            f"  {l['line_no']}. {l['description']} | Qty: {l['quantity']} | "
            f"Unit: {l['unit_price']} | Total: {l['total_price']}"
            for l in d.get("lines", [])
        )
        return f"""
PURCHASE ORDER
==============
PO Number     : {d.get('po_number', 'TBD')}
Vendor        : {d.get('vendor_name', '')}
Date          : {datetime.utcnow().strftime('%Y-%m-%d')}
Payment Terms : {d.get('payment_terms', 'NET30')}
Delivery To   : {d.get('delivery_address', '')}

LINE ITEMS:
{lines}

TOTAL VALUE   : {d.get('total_value', '')} {d.get('currency', 'NGN')}

This PO is issued under Seplat Energy procurement regulations.
"""

    def _gen_contract(self, d: Dict) -> str:
        return f"""
FRAMEWORK CONTRACT AGREEMENT
=============================
Contract No   : {d.get('contract_number', 'TBD')}
Vendor        : {d.get('vendor_name', '')}
Effective     : {d.get('start_date', '')} to {d.get('end_date', '')}
Total Value   : {d.get('total_value', '')} {d.get('currency', 'NGN')}

SCOPE: {d.get('scope', '')}

SLA TERMS: {json.dumps(d.get('sla_terms', {}), indent=2)}

[Full legal terms appended per Seplat standard contract template]
"""

    def _gen_award_letter(self, d: Dict) -> str:
        return f"""
AWARD NOTIFICATION
==================
Date     : {datetime.utcnow().strftime('%Y-%m-%d')}
To       : {d.get('vendor_name', '')}
Re       : {d.get('rfq_number', '')}

We are pleased to inform you that your bid has been selected for award.

Award Value  : {d.get('award_value', '')} NGN
Justification: {d.get('justification', '')}

Please acknowledge receipt within 48 hours.

Seplat Energy — Procurement Agent Squadron
"""

    def _gen_rejection_letter(self, d: Dict) -> str:
        return f"""
UNSUCCESSFUL BID NOTIFICATION
==============================
Date     : {datetime.utcnow().strftime('%Y-%m-%d')}
To       : {d.get('vendor_name', '')}
Re       : {d.get('rfq_number', '')}

Thank you for participating in our tender process.
After careful evaluation, we regret to inform you that your bid was not selected.

We encourage you to participate in future opportunities.

Seplat Energy — Procurement Agent Squadron
"""

    def _gen_scorecard(self, d: Dict) -> str:
        return f"""
VENDOR PERFORMANCE SCORECARD
==============================
Vendor       : {d.get('vendor_name', '')}
Period       : {d.get('period', '')}
Overall Score: {d.get('overall_score', 0):.1f}/100

Delivery     : {d.get('delivery_score', 0):.1f}
Quality      : {d.get('quality_score', 0):.1f}
Price        : {d.get('price_competitiveness', 0):.1f}
Responsiveness: {d.get('responsiveness', 0):.1f}
Compliance   : {d.get('compliance_score', 0):.1f}

Commentary: {d.get('commentary', 'N/A')}
"""

    def _gen_amendment(self, d: Dict) -> str:
        return f"""
CONTRACT AMENDMENT
==================
Contract No  : {d.get('contract_number', '')}
Amendment No : {d.get('amendment_number', 1)}
Date         : {datetime.utcnow().strftime('%Y-%m-%d')}

CHANGES:
{d.get('changes_description', '')}

New End Date  : {d.get('new_end_date', '')}
New Value     : {d.get('new_value', '')}

[Requires authorised signatures per contract terms]
"""
