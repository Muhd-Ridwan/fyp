/**
 * Doc page
 */

import { useState, useEffect, useCallback } from "react";
import {
  FolderPlus,
  ChevronRight,
  Loader2,
  AlertCircle,
  Send,
} from "lucide-react";
import type { Document, Folder, EmployeeProfile } from "../types";
import {
  listDocuments,
  uploadDocument,
  renameDocument,
  deleteDocument,
  getDownloadUrl,
} from "../api/documentsApi";
import {
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
} from "../api/foldersApi";
import ContentList from "../components/documents/ContentList";
import UploadZone from "../components/documents/UploadZone";
import RenameModal from "../components/documents/RenameModal";
import ConfirmModal from "../components/ui/ConfirmModal";
import { toast } from "sonner";

interface DocumentsPageProps {
  profile: EmployeeProfile;
  idToken: string;
  onAskAI?: (prompt: string) => void;
}

interface BreadcrumbEntry {
  folderId: string;
  folderName: string;
}

type RenameTarget =
  | { type: "folder"; item: Folder }
  | { type: "file"; item: Document };

type DeleteTarget =
  | { type: "folder"; item: Folder }
  | { type: "file"; item: Document };

export default function DocumentsPage({
  profile,
  idToken,
  onAskAI,
}: DocumentsPageProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [folderStack, setFolderStack] = useState<BreadcrumbEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  // Derived
  const currentFolderId = folderStack.at(-1)?.folderId ?? null;
  const currentFolderName = folderStack.at(-1)?.folderName ?? "";
  const isInsideFolder = folderStack.length > 0;
  const totalItems = folders.length + files.length;

  // DATA LOADING

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [foldersData, filesData] = await Promise.all([
        listFolders(idToken, currentFolderId ?? undefined),
        listDocuments(idToken, currentFolderId ?? undefined),
      ]);
      setFolders(foldersData.folders);
      setFiles(filesData.files);
    } catch (err) {
      console.error(err);
      setError("Failed to load doc. Try again");
    } finally {
      setLoading(false);
    }
  }, [idToken, currentFolderId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // NAV

  function handleFolderOpen(folderId: string) {
    const folder = folders.find((f) => f.folder_id === folderId);
    setFolderStack((prev) => [
      ...prev,
      { folderId, folderName: folder?.name ?? "" },
    ]);
  }

  function handleGoRoot() {
    setFolderStack([]);
  }

  function handleBreadcrumbNav(index: number) {
    setFolderStack((prev) => prev.slice(0, index + 1));
  }

  // UPLOAD

  async function handleUpload(files: File[]) {
    setUploading(true);
    const id = toast.loading(
      files.length > 1 ? `Uploading ${files.length} files...` : "Uploading file...",
    );
    try {
      for (const file of files) {
        await uploadDocument(idToken, file, currentFolderId ?? undefined);
      }
      await loadData();
      toast.success(
        files.length > 1 ? `${files.length} files uploaded` : "File uploaded",
        { id },
      );
    } catch (err) {
      console.error(err);
      toast.error("Upload failed. Try again", { id });
    } finally {
      setUploading(false);
    }
  }

  // CREATE FOLDER

  async function handleCreateFolder(name: string) {
    setCreateFolderOpen(false);
    try {
      await createFolder(idToken, name, currentFolderId ?? undefined);
      await loadData();
      toast.success("Folder created");
    } catch (err) {
      console.error(err);
      toast.error("Failed to create folder. Try again");
    }
  }

  // RENAME

  async function handleRenameConfirm(newName: string) {
    if (!renameTarget) return;
    const target = renameTarget;
    setRenameTarget(null);
    try {
      if (target.type === "folder") {
        await renameFolder(idToken, target.item.folder_id, newName);
      } else {
        await renameDocument(idToken, target.item.file_id, newName);
      }
      await loadData();
      toast.success("Renamed successfully");
    } catch (err) {
      console.error(err);
      toast.error("Rename failed. Try again");
    }
  }

  // DELETE

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    const id = toast.loading(
      target.type === "folder" ? "Deleting folder..." : "Deleting file...",
    );
    try {
      if (target.type === "folder") {
        await deleteFolder(idToken, target.item.folder_id);
        // If deleting a folder in curr path, go back to root
        if (folderStack.some((e) => e.folderId === target.item.folder_id)) {
          handleGoRoot();
        }
      } else {
        await deleteDocument(idToken, target.item.file_id);
      }
      await loadData();
      toast.success(
        target.type === "folder" ? "Folder deleted" : "File deleted",
        { id },
      );
    } catch (err) {
      console.error(err);
      toast.error("Delete failed. Try again.", { id });
    }
  }

  // DOWNLOAD

  async function handleDownload(doc: Document) {
    try {
      const { url } = await getDownloadUrl(idToken, doc.file_id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(err);
      toast.error("Download failed. Try again");
    }
  }

  // RENDER

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
        {/* PAGE HEADERS */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <button
                onClick={handleGoRoot}
                className={`transition-colors ${isInsideFolder ? "hover:text-indigo-600 cursor-pointer" : "text-slate-500 font-medium pointer-events-none"}`}
              >
                Documents
              </button>
              {folderStack.map((entry, index) => (
                <span
                  key={entry.folderId}
                  className="flex items-center gap-1.5"
                >
                  <ChevronRight size={12} aria-hidden="true" />
                  <button
                    onClick={() =>
                      index < folderStack.length - 1
                        ? handleBreadcrumbNav(index)
                        : undefined
                    }
                    className={`transition-colors ${index < folderStack.length - 1 ? "hover:text-indigo-600 cursor-pointer" : "text-slate-600 font-medium pointer-events-none"}`}
                  >
                    {entry.folderName}
                  </button>
                </span>
              ))}
            </div>

            <h1 className="text-lg font-semibold text-slate-900">
              {isInsideFolder
                ? currentFolderName
                : `${profile.department} documents`}
            </h1>
          </div>

          {/* New Folder */}
          <button
            onClick={() => setCreateFolderOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <FolderPlus size={15} aria-hidden="true" />
            <span className="hidden sm:inline">New Folder</span>
          </button>
        </div>
        {onAskAI && (
          <div className="flex gap-2 mb-4">
            <input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && aiPrompt.trim()) {
                  onAskAI(aiPrompt.trim());
                  setAiPrompt("");
                }
              }}
              placeholder="Ask AI about your documents..."
              className="flex-1 text-sm px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              onClick={() => {
                if (aiPrompt.trim()) {
                  onAskAI(aiPrompt.trim());
                  setAiPrompt("");
                }
              }}
              disabled={!aiPrompt.trim()}
              className="px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              <Send size={15} />
            </button>
          </div>
        )}
        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-2.5 px-4 py-3 mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
            <AlertCircle
              size={16}
              className="flex-shrink-0"
              aria-hidden="true"
            />
            <p className="text-sm flex-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Upload Zone */}
        <div className="mb-4">
          <UploadZone onUpload={handleUpload} uploading={uploading} />
        </div>

        {/* Content List */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-100 flex fitems-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              Folders &amp; files
            </span>
            <span className="text-xs text-slate-400">
              {totalItems} {totalItems === 1 ? "item" : "items"}
            </span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2
                size={24}
                className="text-indigo-500 animate-spin"
                aria-hidden="true"
              />
            </div>
          ) : (
            <ContentList
              folders={folders}
              files={files}
              isInsideFolder={isInsideFolder}
              onFolderOpen={handleFolderOpen}
              onFolderRename={(folder) =>
                setRenameTarget({ type: "folder", item: folder })
              }
              onFolderDelete={(folder) =>
                setDeleteTarget({ type: "folder", item: folder })
              }
              onFileDownload={handleDownload}
              onFileRename={(file) =>
                setRenameTarget({ type: "file", item: file })
              }
              onFileDelete={(file) =>
                setDeleteTarget({ type: "file", item: file })
              }
            />
          )}
        </div>
      </div>

      {/* Create Folder Modal */}
      {createFolderOpen && (
        <RenameModal
          title="New Folder"
          currentName=""
          onConfirm={handleCreateFolder}
          onClose={() => setCreateFolderOpen(false)}
        />
      )}

      {/* Rename Modal */}
      {renameTarget && (
        <RenameModal
          title={`Rename ${renameTarget.type}`}
          currentName={
            renameTarget.type === "folder"
              ? renameTarget.item.name
              : renameTarget.item.display_name
          }
          onConfirm={handleRenameConfirm}
          onClose={() => setRenameTarget(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmModal
          title={`Delete ${deleteTarget.type}`}
          description={
            deleteTarget.type === "folder"
              ? `"${deleteTarget.item.name}" and all files and folders inside it will be deleted. This cannot be undone`
              : `"${deleteTarget?.item.display_name}" will be permanently deleted. This cannot be undone.`
          }
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
