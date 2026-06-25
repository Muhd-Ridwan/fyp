import type { Employee, RegisterEmployeePayload } from "../types";
import { getApiBaseUrl, authHeaders, handleResponse } from "./utils";

export async function getEmployees(idToken: string): Promise<Employee[]> {
  const response = await fetch(`${getApiBaseUrl()}/admin/employees`, {
    headers: authHeaders(idToken),
  });
  return handleResponse<Employee[]>(response);
}

export async function registerEmployee(
  idToken: string,
  payload: RegisterEmployeePayload,
): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/admin/register`, {
    method: "POST",
    headers: { ...authHeaders(idToken), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function updateEmployeeDepartment(
  idToken: string,
  email: string,
  department: string,
): Promise<void> {
  const response = await fetch(
    `${getApiBaseUrl()}/admin/employees/${encodeURIComponent(email)}`,
    {
      method: "PUT",
      headers: { ...authHeaders(idToken), "Content-Type": "application/json" },
      body: JSON.stringify({ department }),
    },
  );
  return handleResponse(response);
}

export async function lockEmployee(
  idToken: string,
  email: string,
): Promise<void> {
  const response = await fetch(
    `${getApiBaseUrl()}/admin/employees/${encodeURIComponent(email)}/lock`,
    { method: "POST", headers: authHeaders(idToken) },
  );
  return handleResponse(response);
}

export async function unlockEmployee(
  idToken: string,
  email: string,
): Promise<void> {
  const response = await fetch(
    `${getApiBaseUrl()}/admin/employees/${encodeURIComponent(email)}/unlock`,
    { method: "POST", headers: authHeaders(idToken) },
  );
  return handleResponse(response);
}
