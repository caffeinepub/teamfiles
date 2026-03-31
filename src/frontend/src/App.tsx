import { HttpAgent } from "@icp-sdk/core/agent";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactQuill from "react-quill-new";
import type { DocumentSummary, FileMetadata, Folder } from "./backend";
import { loadConfig } from "./config";
import { useIsMobile } from "./hooks/use-mobile";
import { useActor } from "./hooks/useActor";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import {
  useGetDocument,
  useListDocuments,
  useListFiles,
  useListFolders,
} from "./hooks/useQueries";
import { StorageClient } from "./utils/StorageClient";
import "react-quill-new/dist/quill.snow.css";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  Archive,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  File,
  FileEdit,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Files,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function formatDate(nanos: bigint): string {
  const ms = Number(nanos / 1_000_000n);
  const date = new Date(ms);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(principal: string): string {
  return principal.slice(0, 2).toUpperCase();
}

async function uploadFileToStorage(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const config = await loadConfig();
  const agent = new HttpAgent({ host: config.backend_host });
  const storageClient = new StorageClient(
    config.bucket_name,
    config.storage_gateway_url,
    config.backend_canister_id,
    config.project_id,
    agent,
  );
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { hash } = await storageClient.putFile(bytes, onProgress);
  return hash;
}

async function triggerDownload(hash: string, filename: string): Promise<void> {
  const config = await loadConfig();
  const agent = new HttpAgent({ host: config.backend_host });
  const storageClient = new StorageClient(
    config.bucket_name,
    config.storage_gateway_url,
    config.backend_canister_id,
    config.project_id,
    agent,
  );
  const url = await storageClient.getDirectURL(hash);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─────────────────────────────────────────────────
// File Type Icon
// ─────────────────────────────────────────────────

function FileTypeIcon({
  mimeType,
  isDoc = false,
}: { mimeType: string; isDoc?: boolean }) {
  if (isDoc) return <FileEdit className="h-4 w-4 text-primary" />;
  if (mimeType === "application/pdf")
    return <FileText className="h-4 w-4 text-red-500" />;
  if (mimeType.startsWith("image/"))
    return <ImageIcon className="h-4 w-4 text-green-500" />;
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("csv") ||
    mimeType === "application/vnd.ms-excel"
  )
    return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  if (mimeType.startsWith("video/"))
    return <FileVideo className="h-4 w-4 text-purple-500" />;
  if (
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    mimeType.includes("7z") ||
    mimeType.includes("tar") ||
    mimeType.includes("archive")
  )
    return <Archive className="h-4 w-4 text-yellow-500" />;
  if (
    mimeType.includes("word") ||
    mimeType.includes("document") ||
    mimeType.startsWith("text/")
  )
    return <FileText className="h-4 w-4 text-primary" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

// ─────────────────────────────────────────────────
// Inline Rename Input
// ─────────────────────────────────────────────────

interface InlineRenameInputProps {
  value: string;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
  className?: string;
}

function InlineRenameInput({
  value,
  onConfirm,
  onCancel,
  isLoading = false,
  className,
}: InlineRenameInputProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const handleConfirm = () => {
    if (draft.trim() && draft.trim() !== value) {
      onConfirm(draft.trim());
    } else {
      onCancel();
    }
  };

  return (
    <div className="flex items-center gap-1 flex-1 min-w-0">
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleConfirm();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={handleConfirm}
        disabled={isLoading}
        className={cn(
          "text-[13.5px] font-medium bg-background border border-primary/40 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary/30 min-w-0 flex-1 text-foreground",
          className,
        )}
        data-ocid="inline_rename.input"
      />
      {isLoading && (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground flex-shrink-0" />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// Quill modules (static, defined outside component)
// ─────────────────────────────────────────────────

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["clean"],
  ],
};

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

type NavView = "files" | "documents" | "recent";
type FileRow =
  | { kind: "file"; data: FileMetadata }
  | { kind: "doc"; data: DocumentSummary };

// ─────────────────────────────────────────────────
// Login Page
// ─────────────────────────────────────────────────

function LoginPage({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="bg-card rounded-2xl border border-border shadow-card p-10 text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="h-11 w-11 rounded-xl bg-tf-blue flex items-center justify-center shadow-sm">
              <Files className="h-6 w-6 text-white" />
            </div>
            <span className="text-[22px] font-bold text-foreground tracking-tight">
              TeamFiles
            </span>
          </div>

          <h1 className="text-[17px] font-semibold text-foreground mb-2">
            Sign in to your workspace
          </h1>
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
            Secure file sharing for your team, powered by the Internet Computer
          </p>

          <button
            type="button"
            onClick={onLogin}
            data-ocid="login.primary_button"
            className="w-full h-11 flex items-center justify-center gap-2 bg-tf-blue hover:bg-tf-blue-hover text-white text-[14px] font-semibold rounded-lg transition-colors"
          >
            <Shield className="h-4 w-4" />
            Sign in with Internet Identity
          </button>

          <p className="text-xs text-muted-foreground mt-6">
            Authentication secured by the Internet Computer Protocol
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5">
          &copy; {new Date().getFullYear()}. Built with ♥ using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            className="underline underline-offset-2 hover:text-foreground transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            caffeine.ai
          </a>
        </p>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────

interface SidebarProps {
  activeView: NavView;
  onViewChange: (view: NavView) => void;
  onUploadClick: () => void;
  onNewDocClick: () => void;
  onNewFolderClick: () => void;
  onClose?: () => void;
}

function Sidebar({
  activeView,
  onViewChange,
  onUploadClick,
  onNewDocClick,
  onNewFolderClick,
  onClose,
}: SidebarProps) {
  const navItems: { id: NavView; label: string; icon: React.ElementType }[] = [
    { id: "files", label: "My Files", icon: Files },
    { id: "documents", label: "Documents", icon: FileEdit },
    { id: "recent", label: "Recently Uploaded", icon: Clock },
  ];

  return (
    <aside className="w-64 h-full bg-sidebar flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-[18px] border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-tf-blue flex items-center justify-center">
            <Files className="h-[18px] w-[18px] text-white" />
          </div>
          <span className="text-[18px] font-bold text-sidebar-foreground tracking-tight">
            TeamFiles
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5" data-ocid="nav.section">
        <p className="text-[10.5px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-3 pb-2">
          Navigation
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => onViewChange(item.id)}
              data-ocid={`nav.${item.id}.link`}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-[9px] rounded-lg text-left transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-[15px] w-[15px] flex-shrink-0" />
              <span className="text-[13px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* CTA Buttons */}
      <div className="px-3 pb-6 pt-2 space-y-2 border-t border-sidebar-border">
        <div className="pt-4 space-y-2">
          <button
            type="button"
            onClick={onUploadClick}
            data-ocid="sidebar.upload_button"
            className="w-full flex items-center justify-center gap-2 bg-tf-green hover:bg-tf-green-hover text-white rounded-lg h-[38px] text-[13px] font-semibold transition-colors"
          >
            <Upload className="h-[15px] w-[15px]" />
            Upload File
          </button>
          <button
            type="button"
            onClick={onNewDocClick}
            data-ocid="sidebar.new_document_button"
            className="w-full flex items-center justify-center gap-2 bg-tf-blue hover:bg-tf-blue-hover text-white rounded-lg h-[38px] text-[13px] font-semibold transition-colors"
          >
            <Plus className="h-[15px] w-[15px]" />
            New Document
          </button>
          <button
            type="button"
            onClick={onNewFolderClick}
            data-ocid="sidebar.new_folder_button"
            className="w-full flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg h-[38px] text-[13px] font-semibold transition-colors border border-border"
          >
            <FolderPlus className="h-[15px] w-[15px]" />
            New Folder
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────
// Top Bar
// ─────────────────────────────────────────────────

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  principal: string;
  onLogout: () => void;
  onMenuToggle: () => void;
}

function TopBar({
  searchQuery,
  onSearchChange,
  principal,
  onLogout,
  onMenuToggle,
}: TopBarProps) {
  const initials = getInitials(principal);

  return (
    <header className="h-[60px] bg-card border-b border-border flex items-center px-4 md:px-6 gap-3 flex-shrink-0">
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={onMenuToggle}
        className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
        data-ocid="header.menu_toggle"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search */}
      <div className="relative flex-1 max-w-xl">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[15px] w-[15px] text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search files and documents..."
          data-ocid="files.search_input"
          className="w-full h-9 pl-10 pr-4 rounded-full border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
        />
      </div>

      {/* User area */}
      <div className="flex items-center gap-2 ml-auto">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="text-[13px] font-medium text-foreground hidden sm:block max-w-[120px] truncate">
          {principal.slice(0, 14)}…
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
        <button
          type="button"
          onClick={onLogout}
          data-ocid="header.logout_button"
          className="ml-1 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md hover:bg-destructive/5"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────
// Files View
// ─────────────────────────────────────────────────

interface FilesViewProps {
  view: NavView;
  searchQuery: string;
  onOpenDoc: (docId: string) => void;
  onUploadClick: () => void;
  onNewDocClick: () => void;
  currentFolderId: string | null;
  onFolderChange: (folderId: string | null) => void;
  folders: Folder[];
}

function FilesView({
  view,
  searchQuery,
  onOpenDoc,
  onUploadClick,
  onNewDocClick,
  currentFolderId,
  onFolderChange,
  folders,
}: FilesViewProps) {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { data: files, isLoading: filesLoading } = useListFiles();
  const { data: documents, isLoading: docsLoading } = useListDocuments();
  const isLoading = filesLoading || docsLoading;

  // In recent view, no folder filtering
  const isRecent = view === "recent";
  const sevenDaysAgo =
    BigInt(Date.now() - 7 * 24 * 60 * 60 * 1000) * 1_000_000n;

  const allRows: FileRow[] = [
    ...(view !== "documents"
      ? (files ?? []).map((f): FileRow => ({ kind: "file", data: f }))
      : []),
    ...(view !== "recent"
      ? (documents ?? []).map((d): FileRow => ({ kind: "doc", data: d }))
      : []),
  ];

  const recentRows: FileRow[] = [
    ...(files ?? []).map((f): FileRow => ({ kind: "file", data: f })),
    ...(documents ?? []).map((d): FileRow => ({ kind: "doc", data: d })),
  ].filter((r) => {
    const ts = r.kind === "file" ? r.data.uploadedAt : r.data.updatedAt;
    return ts >= sevenDaysAgo;
  });

  const viewRows = isRecent ? recentRows : allRows;

  // Filter by current folder (not applied to recent view)
  const folderFilteredRows = isRecent
    ? viewRows
    : viewRows.filter((row) => {
        const fId = row.data.folderId ?? null;
        return fId === currentFolderId;
      });

  const filtered = folderFilteredRows.filter((row) => {
    const name = row.kind === "file" ? row.data.name : row.data.title;
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const sorted = [...filtered].sort((a, b) => {
    const aDate = a.kind === "file" ? a.data.uploadedAt : a.data.updatedAt;
    const bDate = b.kind === "file" ? b.data.uploadedAt : b.data.updatedAt;
    return bDate > aDate ? 1 : -1;
  });

  // Folders shown only at root in non-recent views
  const showFolders = !isRecent && currentFolderId === null;
  const filteredFolders = showFolders
    ? folders.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : [];

  const deleteMutation = useMutation({
    mutationFn: async ({ kind, id }: { kind: "file" | "doc"; id: string }) => {
      if (!actor) throw new Error("No actor");
      if (kind === "file") return actor.deleteFile(id);
      return actor.deleteDocument(id);
    },
    onSuccess: (_, { kind }) => {
      queryClient.invalidateQueries({
        queryKey: [kind === "file" ? "files" : "documents"],
      });
      toast.success("Deleted successfully");
    },
    onError: () => toast.error("Failed to delete"),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      if (!actor) throw new Error("No actor");
      return actor.deleteFolder(folderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success("Folder deleted");
    },
    onError: () => toast.error("Failed to delete folder"),
  });

  const moveMutation = useMutation({
    mutationFn: async ({
      kind,
      id,
      folderId,
    }: {
      kind: "file" | "doc";
      id: string;
      folderId: string | null;
    }) => {
      if (!actor) throw new Error("No actor");
      if (kind === "file") return actor.moveFile(id, folderId);
      return actor.moveDocument(id, folderId);
    },
    onSuccess: (_, { kind }) => {
      queryClient.invalidateQueries({
        queryKey: [kind === "file" ? "files" : "documents"],
      });
      toast.success("Moved successfully");
    },
    onError: () => toast.error("Failed to move"),
  });

  const renameFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      if (!actor) throw new Error("No actor");
      return (actor as any).renameFolder(id, name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success("Folder renamed");
    },
    onError: () => toast.error("Failed to rename folder"),
  });

  const renameFileMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      if (!actor) throw new Error("No actor");
      return (actor as any).renameFile(id, name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      toast.success("File renamed");
    },
    onError: () => toast.error("Failed to rename file"),
  });

  const renameDocMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      if (!actor) throw new Error("No actor");
      return (actor as any).renameDocument(id, name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document renamed");
    },
    onError: () => toast.error("Failed to rename document"),
  });

  const [renamingId, setRenamingId] = useState<string | null>(null);

  const currentFolder = folders.find((f) => f.id === currentFolderId) ?? null;

  const pageTitle =
    view === "documents"
      ? "Documents"
      : view === "recent"
        ? "Recently Uploaded"
        : "My Files";

  const hasContent = filteredFolders.length > 0 || sorted.length > 0;

  return (
    <motion.div
      key={view}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex-1 overflow-auto p-4 md:p-6"
      data-ocid="files.page"
    >
      {/* Page header with optional breadcrumb */}
      <div className="mb-5">
        {currentFolder ? (
          <div
            className="flex items-center gap-1.5 mb-0.5"
            data-ocid="files.breadcrumb"
          >
            <button
              type="button"
              onClick={() => onFolderChange(null)}
              data-ocid="files.breadcrumb.link"
              className="text-[13px] text-muted-foreground hover:text-primary transition-colors"
            >
              {pageTitle}
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[13px] font-semibold text-primary">
              {currentFolder.name}
            </span>
          </div>
        ) : (
          <h1 className="text-[17px] font-semibold text-primary">
            {pageTitle}
          </h1>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">
          {isLoading
            ? "Loading…"
            : `${filteredFolders.length + sorted.length} item${
                filteredFolders.length + sorted.length !== 1 ? "s" : ""
              }`}
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[minmax(0,2fr)_140px_100px_120px] gap-2 px-5 py-3 bg-tf-table-header border-b border-border">
          <span className="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wide">
            Name
          </span>
          <span className="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wide">
            Date
          </span>
          <span className="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wide">
            Size
          </span>
          <span className="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wide">
            Actions
          </span>
        </div>

        {/* Loading skeletons */}
        {isLoading && (
          <div
            className="divide-y divide-border"
            data-ocid="files.loading_state"
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="grid grid-cols-[minmax(0,2fr)_140px_100px_120px] gap-2 px-5 py-4 items-center"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-7 w-16" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !hasContent && (
          <div
            className="flex flex-col items-center justify-center py-16 text-center px-6"
            data-ocid="files.empty_state"
          >
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Files className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground mb-1 text-[15px]">
              {view === "recent"
                ? "No recent activity"
                : currentFolder
                  ? `"${currentFolder.name}" is empty`
                  : "No files yet"}
            </p>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              {view === "recent"
                ? "Files uploaded or documents edited in the last 7 days will appear here"
                : currentFolder
                  ? "Upload files or create documents to add them to this folder"
                  : "Upload files or create documents to get started"}
            </p>
            {view !== "recent" && (
              <div className="flex gap-2 flex-wrap justify-center">
                <button
                  type="button"
                  onClick={onUploadClick}
                  data-ocid="files.upload_button"
                  className="flex items-center gap-1.5 text-[13px] font-semibold bg-tf-green hover:bg-tf-green-hover text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={onNewDocClick}
                  data-ocid="files.new_document_button"
                  className="flex items-center gap-1.5 text-[13px] font-semibold bg-tf-blue hover:bg-tf-blue-hover text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Document
                </button>
              </div>
            )}
          </div>
        )}

        {/* Folder rows */}
        {!isLoading && filteredFolders.length > 0 && (
          <div className="divide-y divide-border" data-ocid="folders.list">
            {filteredFolders.map((folder, index) => (
              <div
                key={folder.id}
                data-ocid={`folders.item.${index + 1}`}
                className="grid grid-cols-[minmax(0,2fr)_140px_100px_120px] gap-2 px-5 py-[13px] items-center group hover:bg-tf-row-hover transition-colors"
              >
                {/* Name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center flex-shrink-0">
                    <FolderOpen className="h-4 w-4 text-amber-500" />
                  </div>
                  {renamingId === folder.id ? (
                    <InlineRenameInput
                      value={folder.name}
                      isLoading={renameFolderMutation.isPending}
                      onConfirm={(name) => {
                        renameFolderMutation.mutate(
                          { id: folder.id, name },
                          { onSettled: () => setRenamingId(null) },
                        );
                      }}
                      onCancel={() => setRenamingId(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onFolderChange(folder.id)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setRenamingId(folder.id);
                      }}
                      className="text-[13.5px] font-medium text-foreground truncate text-left hover:text-primary transition-colors"
                    >
                      {folder.name}
                    </button>
                  )}
                </div>

                {/* Date */}
                <span className="text-[13px] text-muted-foreground">
                  {formatDate(folder.createdAt)}
                </span>

                {/* Size — always dash for folders */}
                <span className="text-[13px] text-muted-foreground">—</span>

                {/* Actions */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setRenamingId(folder.id)}
                    data-ocid={`folders.edit_button.${index + 1}`}
                    className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    title="Rename folder"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete folder "${folder.name}"? Files inside will NOT be deleted, but they will be moved to root.`,
                        )
                      ) {
                        deleteFolderMutation.mutate(folder.id);
                      }
                    }}
                    data-ocid={`folders.delete_button.${index + 1}`}
                    className="h-8 w-8 rounded-md hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete folder"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* File rows */}
        {!isLoading && sorted.length > 0 && (
          <div className="divide-y divide-border" data-ocid="files.list">
            {sorted.map((row, index) => {
              const name = row.kind === "file" ? row.data.name : row.data.title;
              const date =
                row.kind === "file" ? row.data.uploadedAt : row.data.updatedAt;
              const size =
                row.kind === "file"
                  ? formatFileSize(Number(row.data.size))
                  : "—";
              const id = row.data.id;

              return (
                <div
                  key={`${row.kind}-${id}`}
                  data-ocid={`files.item.${index + 1}`}
                  className="grid grid-cols-[minmax(0,2fr)_140px_100px_120px] gap-2 px-5 py-[13px] items-center group hover:bg-tf-row-hover transition-colors"
                >
                  {/* Name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      {row.kind === "file" ? (
                        <FileTypeIcon mimeType={row.data.mimeType} />
                      ) : (
                        <FileEdit className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    {renamingId === `${row.kind}-${id}` ? (
                      <InlineRenameInput
                        value={name}
                        isLoading={
                          row.kind === "file"
                            ? renameFileMutation.isPending
                            : renameDocMutation.isPending
                        }
                        onConfirm={(newName) => {
                          const mutation =
                            row.kind === "file"
                              ? renameFileMutation
                              : renameDocMutation;
                          mutation.mutate(
                            { id, name: newName },
                            { onSettled: () => setRenamingId(null) },
                          );
                        }}
                        onCancel={() => setRenamingId(null)}
                      />
                    ) : row.kind === "doc" ? (
                      <button
                        type="button"
                        onClick={() => onOpenDoc(id)}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setRenamingId(`doc-${id}`);
                        }}
                        className="text-[13.5px] font-medium text-foreground truncate text-left hover:text-primary transition-colors"
                      >
                        {name}
                      </button>
                    ) : (
                      <span
                        className="text-[13.5px] font-medium text-foreground truncate cursor-default"
                        onDoubleClick={() => setRenamingId(`file-${id}`)}
                      >
                        {name}
                      </span>
                    )}
                  </div>

                  {/* Date */}
                  <span className="text-[13px] text-muted-foreground">
                    {formatDate(date)}
                  </span>

                  {/* Size */}
                  <span className="text-[13px] text-muted-foreground">
                    {size}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => setRenamingId(`${row.kind}-${id}`)}
                      data-ocid={`files.edit_button.${index + 1}`}
                      className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      title="Rename"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {row.kind === "file" ? (
                      <button
                        type="button"
                        onClick={() =>
                          triggerDownload(row.data.blobHash, row.data.name)
                        }
                        data-ocid={`files.download_button.${index + 1}`}
                        className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenDoc(id)}
                        data-ocid={`files.open_button.${index + 1}`}
                        className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        title="Open document"
                      >
                        <FileEdit className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Move to folder dropdown */}
                    {!isRecent && folders.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            data-ocid={`files.move_button.${index + 1}`}
                            className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            title="Move to folder"
                          >
                            <FolderInput className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="text-[13px]"
                          data-ocid={`files.move_dropdown.${index + 1}`}
                        >
                          {currentFolderId !== null && (
                            <DropdownMenuItem
                              onClick={() =>
                                moveMutation.mutate({
                                  kind: row.kind,
                                  id,
                                  folderId: null,
                                })
                              }
                            >
                              <Files className="h-3.5 w-3.5 mr-2" />
                              Move to root
                            </DropdownMenuItem>
                          )}
                          {folders
                            .filter((f) => f.id !== currentFolderId)
                            .map((f) => (
                              <DropdownMenuItem
                                key={f.id}
                                onClick={() =>
                                  moveMutation.mutate({
                                    kind: row.kind,
                                    id,
                                    folderId: f.id,
                                  })
                                }
                              >
                                <FolderOpen className="h-3.5 w-3.5 mr-2 text-amber-500" />
                                {f.name}
                              </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete "${name}"? This cannot be undone.`,
                          )
                        ) {
                          deleteMutation.mutate({ kind: row.kind, id });
                        }
                      }}
                      data-ocid={`files.delete_button.${index + 1}`}
                      className="h-8 w-8 rounded-md hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────
// Document Editor
// ─────────────────────────────────────────────────

type SaveStatus = "idle" | "unsaved" | "saving" | "saved";

interface DocumentEditorProps {
  docId: string;
  onBack: () => void;
}

function DocumentEditor({ docId, onBack }: DocumentEditorProps) {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { data: doc, isLoading } = useGetDocument(docId);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [initialized, setInitialized] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef(title);
  const contentRef = useRef(content);

  titleRef.current = title;
  contentRef.current = content;

  useEffect(() => {
    if (doc && !initialized) {
      setTitle(doc.title);
      setContent(doc.htmlContent);
      setSaveStatus("saved");
      setInitialized(true);
    }
  }, [doc, initialized]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const performSave = useCallback(async () => {
    if (!actor) return;
    setSaveStatus("saving");
    try {
      await actor.saveDocument(docId, titleRef.current, contentRef.current);
      setSaveStatus("saved");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["document", docId] });
    } catch {
      setSaveStatus("unsaved");
      toast.error("Failed to save — please try again");
    }
  }, [actor, docId, queryClient]);

  const scheduleSave = useCallback(() => {
    setSaveStatus("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(performSave, 2000);
  }, [performSave]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    scheduleSave();
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    scheduleSave();
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-4 md:p-6" data-ocid="doc.loading_state">
        <Skeleton className="h-8 w-28 mb-5" />
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-24" />
          <div className="h-px bg-border" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      className="flex-1 p-4 md:p-6 flex flex-col min-h-0"
      data-ocid="doc.panel"
    >
      <button
        type="button"
        onClick={onBack}
        data-ocid="doc.back_button"
        className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-4 w-fit"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Files
      </button>

      <div className="bg-card border border-border rounded-xl flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Document header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Document title"
              data-ocid="doc.title.input"
              className="w-full text-[17px] font-semibold text-foreground bg-transparent border-none outline-none focus:ring-0 placeholder:text-muted-foreground/40"
            />
            <p className="text-xs text-muted-foreground mt-0.5">
              Text Document
            </p>
          </div>
          <div className="flex-shrink-0 pt-0.5">
            {saveStatus === "saving" && (
              <span
                className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground"
                data-ocid="doc.loading_state"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </span>
            )}
            {(saveStatus === "saved" || saveStatus === "idle") && (
              <span
                className="flex items-center gap-1.5 text-[12.5px] text-green-600"
                data-ocid="doc.success_state"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Saved
              </span>
            )}
            {saveStatus === "unsaved" && (
              <span
                className="text-[12.5px] text-muted-foreground"
                data-ocid="doc.error_state"
              >
                Unsaved changes
              </span>
            )}
          </div>
        </div>

        {/* Quill editor */}
        <div
          className="tf-quill-wrapper flex flex-col flex-1 min-h-0"
          data-ocid="doc.editor"
        >
          <ReactQuill
            value={content}
            onChange={handleContentChange}
            modules={quillModules}
            theme="snow"
            placeholder="Start writing your document…"
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────

function Dashboard({
  onLogout,
  principal,
}: { onLogout: () => void; principal: string }) {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [activeView, setActiveView] = useState<NavView>("files");
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const [newDocOpen, setNewDocOpen] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const { data: folders = [] } = useListFolders();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !actor) return;

    setUploadFileName(file.name);
    setUploadProgress(0);
    setIsUploading(true);

    try {
      const hash = await uploadFileToStorage(file, (pct) =>
        setUploadProgress(pct),
      );
      await actor.registerFile(
        file.name,
        BigInt(file.size),
        file.type || "application/octet-stream",
        hash,
        currentFolderId,
      );
      queryClient.invalidateQueries({ queryKey: ["files"] });
      toast.success(`"${file.name}" uploaded successfully`);
    } catch (err) {
      console.error(err);
      toast.error("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleNewDoc = async () => {
    if (!actor || !newDocTitle.trim()) return;
    setIsCreatingDoc(true);
    try {
      const docId = await actor.createDocument(
        newDocTitle.trim(),
        currentFolderId,
      );
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setNewDocOpen(false);
      setNewDocTitle("");
      setCurrentDocId(docId);
      setIsEditing(true);
      toast.success("Document created");
    } catch {
      toast.error("Failed to create document");
    } finally {
      setIsCreatingDoc(false);
    }
  };

  const handleNewFolder = async () => {
    if (!actor || !newFolderName.trim()) return;
    setIsCreatingFolder(true);
    try {
      await actor.createFolder(newFolderName.trim());
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      setNewFolderOpen(false);
      setNewFolderName("");
      toast.success(`Folder "${newFolderName.trim()}" created`);
    } catch {
      toast.error("Failed to create folder");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleOpenDoc = (docId: string) => {
    setCurrentDocId(docId);
    setIsEditing(true);
    if (isMobile) setMobileSidebarOpen(false);
  };

  const handleBackFromEditor = () => {
    setIsEditing(false);
    setCurrentDocId(null);
  };

  const handleViewChange = (view: NavView) => {
    setActiveView(view);
    setIsEditing(false);
    setCurrentDocId(null);
    setCurrentFolderId(null);
    if (isMobile) setMobileSidebarOpen(false);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
    if (isMobile) setMobileSidebarOpen(false);
  };

  const handleNewDocClick = () => {
    setNewDocOpen(true);
    if (isMobile) setMobileSidebarOpen(false);
  };

  const handleNewFolderClick = () => {
    setNewFolderOpen(true);
    if (isMobile) setMobileSidebarOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept="*/*"
      />

      {/* Mobile backdrop */}
      <AnimatePresence>
        {isMobile && mobileSidebarOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-30"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {(!isMobile || mobileSidebarOpen) && (
          <motion.div
            key="sidebar"
            initial={isMobile ? { x: -256 } : false}
            animate={{ x: 0 }}
            exit={isMobile ? { x: -256 } : {}}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={cn(
              "h-full flex-shrink-0",
              isMobile ? "fixed left-0 top-0 z-40" : "relative",
            )}
          >
            <Sidebar
              activeView={activeView}
              onViewChange={handleViewChange}
              onUploadClick={handleUploadClick}
              onNewDocClick={handleNewDocClick}
              onNewFolderClick={handleNewFolderClick}
              onClose={isMobile ? () => setMobileSidebarOpen(false) : undefined}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          principal={principal}
          onLogout={onLogout}
          onMenuToggle={() => setMobileSidebarOpen((o) => !o)}
        />

        <main className="flex-1 overflow-auto flex flex-col">
          <AnimatePresence mode="wait">
            {isEditing && currentDocId ? (
              <DocumentEditor
                key={`editor-${currentDocId}`}
                docId={currentDocId}
                onBack={handleBackFromEditor}
              />
            ) : (
              <FilesView
                key={`files-${activeView}`}
                view={activeView}
                searchQuery={searchQuery}
                onOpenDoc={handleOpenDoc}
                onUploadClick={handleUploadClick}
                onNewDocClick={handleNewDocClick}
                currentFolderId={currentFolderId}
                onFolderChange={setCurrentFolderId}
                folders={folders}
              />
            )}
          </AnimatePresence>
        </main>

        <footer className="px-6 py-3 border-t border-border bg-card flex-shrink-0">
          <p className="text-center text-[11px] text-muted-foreground">
            &copy; {new Date().getFullYear()}. Built with ♥ using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              className="underline underline-offset-2 hover:text-foreground transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              caffeine.ai
            </a>
          </p>
        </footer>
      </div>

      {/* Upload Progress Dialog */}
      <Dialog open={isUploading}>
        <DialogContent className="sm:max-w-[380px]" data-ocid="upload.dialog">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Uploading File</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-[13px] text-muted-foreground truncate max-w-full">
              {uploadFileName}
            </p>
            <Progress
              value={uploadProgress}
              className="h-2"
              data-ocid="upload.loading_state"
            />
            <p className="text-[13px] font-semibold text-center text-foreground">
              {Math.round(uploadProgress)}%
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Document Dialog */}
      <Dialog
        open={newDocOpen}
        onOpenChange={(open) => {
          setNewDocOpen(open);
          if (!open) setNewDocTitle("");
        }}
      >
        <DialogContent className="sm:max-w-[380px]" data-ocid="new_doc.dialog">
          <DialogHeader>
            <DialogTitle className="text-[15px]">New Document</DialogTitle>
          </DialogHeader>
          <div className="py-1">
            <Input
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              placeholder="Enter document title…"
              data-ocid="new_doc.title.input"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNewDoc();
              }}
              autoFocus
              className="text-[13px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewDocOpen(false);
                setNewDocTitle("");
              }}
              data-ocid="new_doc.cancel_button"
              className="text-[13px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleNewDoc}
              disabled={isCreatingDoc || !newDocTitle.trim()}
              data-ocid="new_doc.confirm_button"
              className="bg-tf-blue hover:bg-tf-blue-hover text-white text-[13px]"
            >
              {isCreatingDoc && (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
              )}
              Create Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog
        open={newFolderOpen}
        onOpenChange={(open) => {
          setNewFolderOpen(open);
          if (!open) setNewFolderName("");
        }}
      >
        <DialogContent
          className="sm:max-w-[380px]"
          data-ocid="new_folder.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-[15px]">New Folder</DialogTitle>
          </DialogHeader>
          <div className="py-1">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Enter folder name…"
              data-ocid="new_folder.input"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNewFolder();
              }}
              autoFocus
              className="text-[13px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewFolderOpen(false);
                setNewFolderName("");
              }}
              data-ocid="new_folder.cancel_button"
              className="text-[13px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleNewFolder}
              disabled={isCreatingFolder || !newFolderName.trim()}
              data-ocid="new_folder.confirm_button"
              className="bg-tf-blue hover:bg-tf-blue-hover text-white text-[13px]"
            >
              {isCreatingFolder && (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
              )}
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}

// ─────────────────────────────────────────────────
// App Root
// ─────────────────────────────────────────────────

export default function App() {
  const { identity, login, clear, isInitializing } = useInternetIdentity();

  if (isInitializing) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-ocid="app.loading_state"
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading TeamFiles…</p>
        </div>
      </div>
    );
  }

  if (!identity) {
    return <LoginPage onLogin={login} />;
  }

  return (
    <Dashboard
      onLogout={clear}
      principal={identity.getPrincipal().toString()}
    />
  );
}
