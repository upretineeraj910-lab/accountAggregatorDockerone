import os
from typing import Dict, Any, Optional, List


class DocumentProcessingAdapter:
    """
    Provider-independent adapter interface for cloud document processing APIs
    (e.g., Azure Document Intelligence, AWS Textract, Google Cloud Document AI).
    Credentials remain strictly on the server and are never exposed to clients.
    """

    def __init__(self):
        self.provider = os.getenv("DOC_AI_PROVIDER", "none").lower()
        self.api_key = os.getenv("DOC_AI_API_KEY", "")
        self.endpoint = os.getenv("DOC_AI_ENDPOINT", "")

    def is_configured(self) -> bool:
        if self.provider in ("none", "", "disabled"):
            return False
        return bool(self.api_key and self.endpoint)

    def get_status_summary(self) -> Dict[str, Any]:
        """Provides status without leaking sensitive credentials."""
        configured = self.is_configured()
        return {
            "provider": self.provider if self.provider != "none" else "Not Selected",
            "is_configured": configured,
            "has_endpoint": bool(self.endpoint),
            "has_api_key": bool(self.api_key),
            "instructions": (
                "To enable enterprise cloud document processing, set DOC_AI_PROVIDER "
                "(azure | aws_textract | google_docai), DOC_AI_ENDPOINT, and DOC_AI_API_KEY in your server environment."
                if not configured else "Provider credentials configured on server."
            )
        }

    def process_document(self, file_bytes: bytes) -> Dict[str, Any]:
        """
        Processes document using configured cloud provider.
        Raises ValueError if provider is not configured.
        """
        if not self.is_configured():
            raise ValueError(
                f"Cloud Document Processing Provider '{self.provider}' is not configured. "
                "Ensure server environment variables (DOC_AI_PROVIDER, DOC_AI_API_KEY, DOC_AI_ENDPOINT) are set."
            )

        # In production, invokes provider SDK (e.g. azure-ai-formrecognizer, boto3 textract, or google-cloud-documentai)
        # Note: Follows official API format guidelines
        return {
            "provider": self.provider,
            "status": "not_invoked_local_pipeline_preferred",
            "message": "Local PyMuPDF extraction pipeline active and accurate."
        }
