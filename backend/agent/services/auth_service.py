from __future__ import annotations

import random
import hashlib
from datetime import timedelta
from typing import Any

import jwt
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone

from agent.models import EmployeeAccount, ManagerAccount

JWT_ALGO = "HS256"
JWT_EXP_DAYS = 7


def _jwt_signing_key() -> str:
    candidate = getattr(settings, "JWT_SECRET_KEY", "") or settings.SECRET_KEY
    if len(candidate.encode("utf-8")) >= 32:
        return candidate
    # Derive a 32+ byte key deterministically when project SECRET_KEY is too short.
    return hashlib.sha256(candidate.encode("utf-8")).hexdigest()


class AuthError(Exception):
    pass


def issue_employee_token(account: EmployeeAccount) -> dict[str, Any]:
    expires_at = timezone.now() + timedelta(days=JWT_EXP_DAYS)
    payload = {
        "sub": str(account.id),
        "role": "employee",
        "email": account.email,
        "employee_id": account.employee_id,
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(payload, _jwt_signing_key(), algorithm=JWT_ALGO)
    return {
        "access_token": token,
        "expires_at": expires_at.isoformat(),
    }


def decode_employee_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, _jwt_signing_key(), algorithms=[JWT_ALGO])
    except Exception as error:
        raise AuthError(str(error))


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[JWT_ALGO])
    except Exception as error:
        raise AuthError(str(error))


def get_account_from_auth_header(auth_header: str | None) -> EmployeeAccount:
    if not auth_header or not auth_header.startswith("Bearer "):
        raise AuthError("Missing bearer token")
    token = auth_header.split(" ", 1)[1].strip()
    payload = decode_token(token)
    if payload.get("role") != "employee":
        raise AuthError("Invalid token role")
    account_id = payload.get("sub")
    try:
        return EmployeeAccount.objects.get(id=account_id)
    except EmployeeAccount.DoesNotExist:
        raise AuthError("Invalid account")


def issue_manager_token(account: ManagerAccount) -> dict[str, Any]:
    expires_at = timezone.now() + timedelta(days=JWT_EXP_DAYS)
    payload = {
        "sub": str(account.id),
        "role": "manager",
        "email": account.email,
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(payload, _jwt_signing_key(), algorithm=JWT_ALGO)
    return {
        "access_token": token,
        "expires_at": expires_at.isoformat(),
    }


def get_manager_from_auth_header(auth_header: str | None) -> ManagerAccount:
    if not auth_header or not auth_header.startswith("Bearer "):
        raise AuthError("Missing bearer token")
    token = auth_header.split(" ", 1)[1].strip()
    payload = decode_token(token)
    if payload.get("role") != "manager":
        raise AuthError("Invalid token role")
    account_id = payload.get("sub")
    try:
        return ManagerAccount.objects.get(id=account_id)
    except ManagerAccount.DoesNotExist:
        raise AuthError("Invalid manager account")


def manager_registration_locked() -> bool:
    return ManagerAccount.objects.exists()


def register_manager(email: str, full_name: str, password: str) -> ManagerAccount:
    if manager_registration_locked():
        raise AuthError("Manager registration is locked")
    return ManagerAccount.objects.create(
        email=email,
        full_name=full_name,
        password_hash=make_password(password),
        registration_locked=True,
    )


def login_manager(email: str, password: str) -> ManagerAccount:
    try:
        account = ManagerAccount.objects.get(email=email)
    except ManagerAccount.DoesNotExist:
        raise AuthError("Invalid email or password")

    if not check_password(password, account.password_hash):
        raise AuthError("Invalid email or password")
    return account


def set_manager_reset_otp(email: str) -> str:
    try:
        account = ManagerAccount.objects.get(email=email)
    except ManagerAccount.DoesNotExist:
        raise AuthError("Email not found")

    otp = f"{random.randint(100000, 999999)}"
    account.reset_otp = otp
    account.reset_otp_expires_at = timezone.now() + timedelta(minutes=10)
    account.save(update_fields=["reset_otp", "reset_otp_expires_at", "updated_at"])
    return otp


def reset_manager_password(email: str, otp: str, new_password: str) -> None:
    try:
        account = ManagerAccount.objects.get(email=email)
    except ManagerAccount.DoesNotExist:
        raise AuthError("Email not found")

    if not account.reset_otp or account.reset_otp != otp:
        raise AuthError("Invalid OTP")

    if not account.reset_otp_expires_at or account.reset_otp_expires_at < timezone.now():
        raise AuthError("OTP expired")

    account.password_hash = make_password(new_password)
    account.reset_otp = ""
    account.reset_otp_expires_at = None
    account.save(update_fields=["password_hash", "reset_otp", "reset_otp_expires_at", "updated_at"])


def register_employee(email: str, employee_id: str, full_name: str, password: str) -> EmployeeAccount:
    if EmployeeAccount.objects.filter(email=email).exists():
        raise AuthError("Email already registered")
    if EmployeeAccount.objects.filter(employee_id=employee_id).exists():
        raise AuthError("Employee ID already linked")

    return EmployeeAccount.objects.create(
        email=email,
        employee_id=employee_id,
        full_name=full_name,
        password_hash=make_password(password),
    )


def login_employee(email: str, password: str) -> EmployeeAccount:
    try:
        account = EmployeeAccount.objects.get(email=email)
    except EmployeeAccount.DoesNotExist:
        raise AuthError("Invalid email or password")

    if not check_password(password, account.password_hash):
        raise AuthError("Invalid email or password")

    return account


def set_reset_otp(email: str) -> str:
    try:
        account = EmployeeAccount.objects.get(email=email)
    except EmployeeAccount.DoesNotExist:
        raise AuthError("Email not found")

    otp = f"{random.randint(100000, 999999)}"
    account.reset_otp = otp
    account.reset_otp_expires_at = timezone.now() + timedelta(minutes=10)
    account.save(update_fields=["reset_otp", "reset_otp_expires_at", "updated_at"])
    return otp


def reset_password(email: str, otp: str, new_password: str) -> None:
    try:
        account = EmployeeAccount.objects.get(email=email)
    except EmployeeAccount.DoesNotExist:
        raise AuthError("Email not found")

    if not account.reset_otp or account.reset_otp != otp:
        raise AuthError("Invalid OTP")

    if not account.reset_otp_expires_at or account.reset_otp_expires_at < timezone.now():
        raise AuthError("OTP expired")

    account.password_hash = make_password(new_password)
    account.reset_otp = ""
    account.reset_otp_expires_at = None
    account.save(update_fields=["password_hash", "reset_otp", "reset_otp_expires_at", "updated_at"])
