const STORAGE_KEY = "medarixLinkedStudyId";

export function getLinkedStudyId(): string | undefined {
  const value = localStorage.getItem(STORAGE_KEY)?.trim();
  return value || undefined;
}

export function setLinkedStudyId(studyId: string) {
  localStorage.setItem(STORAGE_KEY, studyId);
}

export function clearLinkedStudyId() {
  localStorage.removeItem(STORAGE_KEY);
}
