export interface OtherPublicNote {
  userId: number;
  content: string;
}

export interface NoteBundle {
  sharedContent: string | null;
  myPublicContent: string | null;
  myPrivateContent: string | null;
  othersPublic: OtherPublicNote[];
}
