import Time "mo:core/Time";
import Nat "mo:core/Nat";
import Map "mo:core/Map";
import Iter "mo:core/Iter";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";

import MixinStorage "blob-storage/Mixin";
import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";


actor {
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);
  include MixinStorage();

  public type Folder = {
    id : Text;
    name : Text;
    createdAt : Int;
    creatorPrincipal : Text;
  };

  public type FileMetadata = {
    id : Text;
    name : Text;
    size : Nat;
    mimeType : Text;
    blobHash : Text;
    uploadedAt : Int;
    uploaderPrincipal : Text;
    folderId : ?Text;
  };

  public type Document = {
    id : Text;
    title : Text;
    htmlContent : Text;
    createdAt : Int;
    updatedAt : Int;
    creatorPrincipal : Text;
    folderId : ?Text;
  };

  public type DocumentSummary = {
    id : Text;
    title : Text;
    createdAt : Int;
    updatedAt : Int;
    folderId : ?Text;
  };

  public type UserProfile = {
    name : Text;
  };

  let folders = Map.empty<Text, Folder>();
  let files = Map.empty<Text, FileMetadata>();
  let documents = Map.empty<Text, Document>();
  let userProfiles = Map.empty<Principal, UserProfile>();

  var nextId = 0;

  func generateId() : Text {
    let id = "id-" # nextId.toText() # "-" # Time.now().toText();
    nextId += 1;
    id;
  };

  // ── User Profile Management ─────────────────────────────────────────────
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // ── Folders ─────────────────────────────────────────────────────────────
  public shared ({ caller }) func createFolder(name : Text) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create folders");
    };
    let folderId = generateId();
    folders.add(folderId, {
      id = folderId;
      name;
      createdAt = Time.now();
      creatorPrincipal = caller.toText();
    });
    folderId;
  };

  public query ({ caller }) func listFolders() : async [Folder] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can list folders");
    };
    let all = folders.values().toArray();
    all.sort(
      func(a, b) {
        if (a.createdAt > b.createdAt) { #less } else if (a.createdAt < b.createdAt) {
          #greater;
        } else { #equal };
      }
    );
  };

  public shared ({ caller }) func deleteFolder(folderId : Text) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete folders");
    };
    let folderExists = folders.get(folderId) != null;
    if (folderExists) folders.remove(folderId);
    folderExists;
  };

  // ── Files ────────────────────────────────────────────────────────────────
  public shared ({ caller }) func registerFile(
    name : Text,
    size : Nat,
    mimeType : Text,
    blobHash : Text,
    folderId : ?Text,
  ) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can register files");
    };
    let fileId = generateId();
    files.add(fileId, {
      id = fileId;
      name;
      size;
      mimeType;
      blobHash;
      uploadedAt = Time.now();
      uploaderPrincipal = caller.toText();
      folderId;
    });
    fileId;
  };

  public query ({ caller }) func listFiles() : async [FileMetadata] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can list files");
    };
    let all = files.values().toArray();
    all.sort(
      func(a, b) {
        if (a.uploadedAt > b.uploadedAt) { #less } else if (a.uploadedAt < b.uploadedAt) {
          #greater;
        } else { #equal };
      }
    );
  };

  public query ({ caller }) func getFileMetadata(fileId : Text) : async ?FileMetadata {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get file metadata");
    };
    files.get(fileId);
  };

  public shared ({ caller }) func deleteFile(fileId : Text) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete files");
    };
    let fileExists = files.get(fileId) != null;
    if (fileExists) files.remove(fileId);
    fileExists;
  };

  public shared ({ caller }) func moveFile(fileId : Text, folderId : ?Text) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can move files");
    };
    switch (files.get(fileId)) {
      case (null) { false };
      case (?existing) {
        files.add(fileId, { existing with folderId });
        true;
      };
    };
  };

  // ── Documents ──────────────────────────────────────────────────────────
  public shared ({ caller }) func createDocument(title : Text, folderId : ?Text) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create documents");
    };
    let docId = generateId();
    let now = Time.now();
    documents.add(docId, {
      id = docId;
      title;
      htmlContent = "";
      createdAt = now;
      updatedAt = now;
      creatorPrincipal = caller.toText();
      folderId;
    });
    docId;
  };

  public shared ({ caller }) func saveDocument(
    docId : Text,
    title : Text,
    htmlContent : Text,
  ) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save documents");
    };
    switch (documents.get(docId)) {
      case (null) { false };
      case (?existing) {
        documents.add(docId, {
          id = existing.id;
          title;
          htmlContent;
          createdAt = existing.createdAt;
          updatedAt = Time.now();
          creatorPrincipal = existing.creatorPrincipal;
          folderId = existing.folderId;
        });
        true;
      };
    };
  };

  public query ({ caller }) func getDocument(docId : Text) : async ?Document {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get documents");
    };
    documents.get(docId);
  };

  public query ({ caller }) func listDocuments() : async [DocumentSummary] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can list documents");
    };
    let all = documents.values().toArray();
    let sorted = all.sort(
      func(a, b) {
        if (a.updatedAt > b.updatedAt) { #less } else if (a.updatedAt < b.updatedAt) {
          #greater;
        } else { #equal };
      }
    );
    sorted.map(
      func(d) {
        {
          id = d.id;
          title = d.title;
          createdAt = d.createdAt;
          updatedAt = d.updatedAt;
          folderId = d.folderId;
        };
      }
    );
  };

  public shared ({ caller }) func deleteDocument(docId : Text) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete documents");
    };
    let docExists = documents.get(docId) != null;
    if (docExists) documents.remove(docId);
    docExists;
  };

  public shared ({ caller }) func moveDocument(docId : Text, folderId : ?Text) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can move documents");
    };
    switch (documents.get(docId)) {
      case (null) { false };
      case (?existing) {
        documents.add(docId, { existing with folderId });
        true;
      };
    };
  };

  public shared ({ caller }) func renameFolder(folderId : Text, newName : Text) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can rename folders");
    };
    switch (folders.get(folderId)) {
      case (null) { false };
      case (?existing) {
        folders.add(folderId, { existing with name = newName });
        true;
      };
    };
  };

  public shared ({ caller }) func renameFile(fileId : Text, newName : Text) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can rename files");
    };
    switch (files.get(fileId)) {
      case (null) { false };
      case (?existing) {
        files.add(fileId, { existing with name = newName });
        true;
      };
    };
  };

  public shared ({ caller }) func renameDocument(docId : Text, newTitle : Text) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can rename documents");
    };
    switch (documents.get(docId)) {
      case (null) { false };
      case (?existing) {
        documents.add(docId, { existing with title = newTitle; updatedAt = Time.now() });
        true;
      };
    };
  };
};
