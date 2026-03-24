"""
esp32_client.py — HTTP client to send ON/OFF commands to ESP32
==============================================================
"""
from __future__ import annotations
import httpx
import asyncio


class ESP32Client:
    def __init__(self, esp32_ip: str, port: int = 80, timeout: float = 4.0):
        self.base_url = f"http://{esp32_ip}:{port}"
        self.timeout  = timeout

    async def send_command(self, device: str, state: str) -> dict:
        """
        Send a control command.

        Args:
            device: "TV" | "Fan" | "AC" | "Light" | "Plug"
            state:  "ON"  | "OFF"
        Returns dict: {"ok": True/False, "response": ...}
        """
        payload = {"device": device, "state": state}
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(f"{self.base_url}/control", json=payload)
                resp.raise_for_status()
                return {"ok": True, "response": resp.json()}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    async def get_status(self) -> dict:
        """Fetch current device states from ESP32."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(f"{self.base_url}/status")
                resp.raise_for_status()
                return {"ok": True, "devices": resp.json()}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}
