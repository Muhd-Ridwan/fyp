// Shared TypeScript types forr fyp frontend
// All shapes mirror the DynamoDB records returned by FastAPI backend

export interface EmployeeProfile {
  email: string;
  name: string;
  department: string;
  role: string;
}

export interface Folder {
  folder_id: string;
  name: string;
  department: string;
  created_by: string;
  created_at: string;
}

export interface Document {
  file_id: string;
  display_name: string;
  s3_key: string;
  department: string;
  folder_id?: string;
  uploaded_by: string;
  uploaded_at: string;
  file_size: number;
  content_type: string;
}

export interface UploadResponse {
  file_id: string;
  display_name: string;
  s3_key: string;
  department: string;
  folder_id?: string;
  uploaded_by: string;
  uploaded_at: string;
  file_size: number;
  content_type: string;
}

export interface DownloadResponse {
  file_id: string;
  filename: string;
  url: string;
}

export interface FolderListResponse {
  department: string;
  folders: Folder[];
}

export interface DocumentListResponse {
  department: string;
  folder_id: string | null;
  files: Document[];
}
