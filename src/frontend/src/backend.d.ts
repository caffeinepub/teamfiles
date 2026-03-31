import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface DocumentSummary {
    id: string;
    title: string;
    createdAt: bigint;
    updatedAt: bigint;
    folderId?: string;
}
export interface FileMetadata {
    id: string;
    name: string;
    size: bigint;
    mimeType: string;
    blobHash: string;
    uploaderPrincipal: string;
    folderId?: string;
    uploadedAt: bigint;
}
export interface Document {
    id: string;
    title: string;
    createdAt: bigint;
    htmlContent: string;
    updatedAt: bigint;
    creatorPrincipal: string;
    folderId?: string;
}
export interface Folder {
    id: string;
    name: string;
    createdAt: bigint;
    creatorPrincipal: string;
}
export interface UserProfile {
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createDocument(title: string, folderId: string | null): Promise<string>;
    createFolder(name: string): Promise<string>;
    deleteDocument(docId: string): Promise<boolean>;
    deleteFile(fileId: string): Promise<boolean>;
    deleteFolder(folderId: string): Promise<boolean>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getDocument(docId: string): Promise<Document | null>;
    getFileMetadata(fileId: string): Promise<FileMetadata | null>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    listDocuments(): Promise<Array<DocumentSummary>>;
    listFiles(): Promise<Array<FileMetadata>>;
    listFolders(): Promise<Array<Folder>>;
    moveDocument(docId: string, folderId: string | null): Promise<boolean>;
    moveFile(fileId: string, folderId: string | null): Promise<boolean>;
    registerFile(name: string, size: bigint, mimeType: string, blobHash: string, folderId: string | null): Promise<string>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    saveDocument(docId: string, title: string, htmlContent: string): Promise<boolean>;
}
