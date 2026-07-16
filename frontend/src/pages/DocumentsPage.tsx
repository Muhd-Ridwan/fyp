/**
 * Doc page
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FolderPlus,
  ChevronRight,
  AlertCircle,
  Send,
  Search,
  X,
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
import SkeletonRow from "../components/documents/SkeletonRow";

interface DocumentsPageProps {
  profile: EmployeeProfile;
  idToken: string;
  onAskAI?: (prompt: string) => void;
}

interface BreadcrumbEntry {
  folderId: string;
  folderName: string;
}

type ActionTarget =
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
  const [renameTarget, setRenameTarget] = useState<ActionTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActionTarget | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [allFolders, setAllFolders] = useState<Folder[]>([]);
  const [allFiles, setAllFiles] = useState<Document[]>([]);

  // Derived
  const currentFolderId = folderStack.at(-1)?.folderId ?? null;
  const currentFolderName = folderStack.at(-1)?.folderName ?? "";
  const isInsideFolder = folderStack.length > 0;
  const totalItems = folders.length + files.length;
  const searchActive = searchOpen && searchQuery.trim().length > 0;
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredFolders = useMemo(
    () =>
      searchActive
        ? allFolders.filter((f) =>
            f.name.toLowerCase().includes(normalizedQuery),
          )
        : [],
    [searchActive, allFolders, normalizedQuery],
  );
  const filteredFiles = useMemo(
    () =>
      searchActive
        ? allFiles.filter((f) =>
            f.display_name.toLowerCase().includes(normalizedQuery),
          )
        : [],
    [searchActive, allFiles, normalizedQuery],
  );

  function buildAncestorChain(
    folderId: string | undefined,
    folderList: Folder[],
  ): BreadcrumbEntry[] {
    const chain: BreadcrumbEntry[] = [];
    let currentId = folderId;
    while (currentId) {
      const folder = folderList.find((f) => f.folder_id === currentId);
      if (!folder) break;
      chain.unshift({ folderId: folder.folder_id, folderName: folder.name });
      currentId = folder.parent_folder_id;
    }
    return chain;
  }

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

  // SEARCH

  async function handleSearchOpen() {
    setSearchOpen(true);
    setSearchLoading(true);
    try {
      const [foldersData, filesData] = await Promise.all([
        listFolders(idToken, undefined, true),
        listDocuments(idToken, undefined, true),
      ]);
      setAllFolders(foldersData.folders);
      setAllFiles(filesData.files);
    } catch (err) {
      console.error(err);
      toast.error("Search failed to load. Try again");
    } finally {
      setSearchLoading(false);
    }
  }

  function handleSearchClose() {
    setSearchOpen(false);
    setSearchQuery("");
  }

  function handleSearchFolderClick(folderId: string) {
    setFolderStack(buildAncestorChain(folderId, allFolders));
    handleSearchClose();
  }

  function handleSearchFileClick(file: Document) {
    setFolderStack(buildAncestorChain(file.folder_id, allFolders));
    handleSearchClose();
  }

  // UPLOAD

  async function handleUpload(selectedFiles: File[]) {
    setUploading(true);
    const id = toast.loading(
      selectedFiles.length > 1
        ? `Uploading ${selectedFiles.length} files...`
        : "Uploading file...",
    );
    try {
      for (const file of selectedFiles) {
        await uploadDocument(idToken, file, currentFolderId ?? undefined);
      }
      await loadData();
      toast.success(
        selectedFiles.length > 1
          ? `${selectedFiles.length} files uploaded`
          : "File uploaded",
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
                : `${profile.department.toUpperCase()} Documents`}
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
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-700">
              Folders &amp; files
            </span>
            {searchOpen ? (
              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search folders & files.."
                  className="flex-1 text-sm px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <button
                  onClick={handleSearchClose}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label="Close search"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">
                  {totalItems} {totalItems === 1 ? "item" : "items"}
                </span>
                <button
                  onClick={handleSearchOpen}
                  className="text-slate-400 hover:text-indigo-600"
                  aria-label="Search folders & files"
                >
                  <Search size={16} />
                </button>
              </div>
            )}
          </div>
          {loading || (searchOpen && searchLoading) ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : (
            <ContentList
              folders={searchActive ? filteredFolders : folders}
              files={searchActive ? filteredFiles : files}
              isInsideFolder={isInsideFolder}
              onFolderOpen={
                searchActive ? handleSearchFolderClick : handleFolderOpen
              }
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
              onFileOpen={searchActive ? handleSearchFileClick : undefined}
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
