-- Study acquisition time (DICOM StudyTime) for worklist filtering and display.
alter table studies add column if not exists study_time time;
