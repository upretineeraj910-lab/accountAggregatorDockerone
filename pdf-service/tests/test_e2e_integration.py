import os
import json
import urllib.request
import urllib.parse
from decimal import Decimal

SAMPLES_DIR = os.path.join(os.path.dirname(__file__), "..", "samples")


def test_fastapi_process_hdfc():
    """Test full processing via FastAPI HTTP endpoint."""
    pdf_path = os.path.join(SAMPLES_DIR, "hdfc_sample.pdf")
    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="hdfc_sample.pdf"\r\n'
        f"Content-Type: application/pdf\r\n\r\n"
    ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    req = urllib.request.Request(
        "http://127.0.0.1:8000/process",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )

    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode())
        assert data["status"] == "success"
        assert len(data["transactions"]) == 9
        assert data["validation_report"]["is_valid"] is True
        assert data["statement_metadata"]["bank_name"] == "HDFC Bank"
        assert data["financial_summary"]["closing_balance"] == 61495.0
        print("[OK] HDFC FastAPI /process test passed")


def test_fastapi_process_encrypted_pdf():
    """Test encrypted PDF handling via HTTP."""
    pdf_path = os.path.join(SAMPLES_DIR, "encrypted_sample.pdf")
    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    # 1. Without password -> expects HTTP 422 with PASSWORD_REQUIRED
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="encrypted_sample.pdf"\r\n'
        f"Content-Type: application/pdf\r\n\r\n"
    ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    req = urllib.request.Request(
        "http://127.0.0.1:8000/process",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )

    try:
        urllib.request.urlopen(req)
        assert False, "Should have failed with 422"
    except urllib.error.HTTPError as e:
        assert e.code == 422
        err_data = json.loads(e.read().decode())
        assert err_data["detail"]["code"] == "PASSWORD_REQUIRED"
        print("[OK] Encrypted PDF without password correctly rejected (422 PASSWORD_REQUIRED)")

    # 2. With password -> succeeds
    body_with_pw = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="encrypted_sample.pdf"\r\n'
        f"Content-Type: application/pdf\r\n\r\n"
    ).encode("utf-8") + file_bytes + (
        f"\r\n--{boundary}\r\n"
        f'Content-Disposition: form-data; name="password"\r\n\r\n'
        f"investor2026\r\n--{boundary}--\r\n"
    ).encode("utf-8")

    req2 = urllib.request.Request(
        "http://127.0.0.1:8000/process",
        data=body_with_pw,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )

    with urllib.request.urlopen(req2) as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode())
        assert data["status"] == "success"
        assert data["statement_metadata"]["is_encrypted"] is True
        print("[OK] Encrypted PDF with password decrypted and processed successfully")


if __name__ == "__main__":
    test_fastapi_process_hdfc()
    test_fastapi_process_encrypted_pdf()
    print("\nALL FASTAPI INTEGRATION TESTS PASSED 100%!")
