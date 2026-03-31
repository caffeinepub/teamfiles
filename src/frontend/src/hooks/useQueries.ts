import { useQuery } from "@tanstack/react-query";
import type {
  Document,
  DocumentSummary,
  FileMetadata,
  Folder,
} from "../backend";
import { useActor } from "./useActor";

export function useListFiles() {
  const { actor, isFetching } = useActor();
  return useQuery<FileMetadata[]>({
    queryKey: ["files"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listFiles();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useListDocuments() {
  const { actor, isFetching } = useActor();
  return useQuery<DocumentSummary[]>({
    queryKey: ["documents"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listDocuments();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetDocument(docId: string | null) {
  const { actor, isFetching } = useActor();
  return useQuery<Document | null>({
    queryKey: ["document", docId],
    queryFn: async () => {
      if (!actor || !docId) return null;
      return actor.getDocument(docId);
    },
    enabled: !!actor && !isFetching && !!docId,
  });
}

export function useListFolders() {
  const { actor, isFetching } = useActor();
  return useQuery<Folder[]>({
    queryKey: ["folders"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listFolders();
    },
    enabled: !!actor && !isFetching,
  });
}
