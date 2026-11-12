//! A "stay a guest" answer, remembered.
//!
//! The takeover prompt used to be asked on every launch a user declined it, because only an
//! approval left a record (the claim in the shared service state) and declining left nothing. That
//! is the ask-forever shape: a person who runs the CLI or a background service next to the app
//! answers the same question each time they open it.
//!
//! This is the missing half, kept app-local like the install id and for the same reason: the shared
//! record belongs to the runtime's owner, and a decision *not* to become one is the app's own.
//! What is remembered is the subject the user declined, as [`ownership::subject_key`] names it,
//! together with the configuration home it was declined for. The decision is therefore reused for
//! exactly the question that was asked and no other:
//!
//! - a different owner, installation or consent generation is a different question and asks again;
//! - a different configuration home is a different runtime and asks again;
//! - the record's revision is not part of the subject, so a service repair or an update does not
//!   make the app forget.
//!
//! The file is advisory in one direction only. A missing, unreadable or corrupt record reads as
//! "nothing remembered", which is the old behaviour of asking, never a silent takeover; a failed
//! write leaves the same. Approving a takeover forgets what was remembered for that home, so a
//! later release back to the CLI is asked about afresh instead of answered by an old "no".

use serde::{Deserialize, Serialize};
use std::{
    fs, io,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

/// The file holding the remembered decisions, in the app's own config directory.
const FILE: &str = "guest-choice.json";

/// A person has a handful of configuration homes at most; the cap keeps a pathological sequence of
/// distinct subjects from growing the file without bound, dropping the oldest decision first.
const MAX_ENTRIES: usize = 16;

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
struct Record {
    #[serde(default)]
    declined: Vec<Entry>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
struct Entry {
    home: String,
    subject: String,
}

/// Where this installation keeps its decisions: the same directory as its install id.
pub fn directory(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok()
}

fn read(directory: &Path) -> Record {
    fs::read_to_string(directory.join(FILE))
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn write(directory: &Path, record: &Record) -> io::Result<()> {
    fs::create_dir_all(directory)?;
    let path = directory.join(FILE);
    let staging = directory.join(format!("{FILE}.{}.tmp", std::process::id()));
    let text = serde_json::to_string(record).map_err(io::Error::other)?;
    if let Err(error) = fs::write(&staging, text) {
        // A write that fails part-way leaves a truncated staging file; it is never the record,
        // but it must not be left next to it either.
        let _ = fs::remove_file(&staging);
        return Err(error);
    }
    // Replacing the file in one step means a crash leaves the old record or the new one, never a
    // half-written one that reads as nothing remembered.
    fs::rename(&staging, &path).inspect_err(|_| {
        let _ = fs::remove_file(&staging);
    })
}

/// Whether this exact subject, in this home, was declined before.
pub fn remembered(directory: &Path, home: &str, subject: &str) -> bool {
    read(directory)
        .declined
        .iter()
        .any(|entry| entry.home == home && entry.subject == subject)
}

/// Remember that the user chose to stay a guest for this subject.
pub fn remember(directory: &Path, home: &str, subject: &str) -> io::Result<()> {
    let mut record = read(directory);
    record
        .declined
        .retain(|entry| !(entry.home == home && entry.subject == subject));
    record.declined.push(Entry {
        home: home.to_owned(),
        subject: subject.to_owned(),
    });
    if record.declined.len() > MAX_ENTRIES {
        let excess = record.declined.len() - MAX_ENTRIES;
        record.declined.drain(..excess);
    }
    write(directory, &record)
}

/// Forget every decision for a home. Taking over is the opposite answer to all of them.
pub fn forget(directory: &Path, home: &str) -> io::Result<()> {
    let mut record = read(directory);
    let before = record.declined.len();
    record.declined.retain(|entry| entry.home != home);
    if record.declined.len() == before {
        return Ok(());
    }
    write(directory, &record)
}

#[cfg(test)]
mod tests {
    use super::{forget, remember, remembered, Record, FILE, MAX_ENTRIES};
    use std::fs;
    use std::path::PathBuf;

    fn scratch(name: &str) -> PathBuf {
        let directory =
            std::env::temp_dir().join(format!("ocx-guest-choice-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&directory);
        directory
    }

    #[test]
    fn nothing_is_remembered_until_a_guest_choice_is_made() {
        let directory = scratch("empty");
        assert!(!remembered(&directory, "/home/a", "none"));
        let _ = fs::remove_dir_all(&directory);
    }

    #[test]
    fn a_remembered_choice_survives_a_relaunch() {
        let directory = scratch("persist");
        remember(&directory, "/home/a", "none").expect("written");
        // A new launch reads the file again; nothing is held in memory between them.
        assert!(remembered(&directory, "/home/a", "none"));
        let _ = fs::remove_dir_all(&directory);
    }

    #[test]
    fn the_choice_answers_only_the_question_that_was_asked() {
        let directory = scratch("scope");
        remember(&directory, "/home/a", "none").expect("written");
        // Another owner is another question, and another home is another runtime.
        assert!(!remembered(&directory, "/home/a", "owned/desktop/other/2"));
        assert!(!remembered(&directory, "/home/b", "none"));
        let _ = fs::remove_dir_all(&directory);
    }

    #[test]
    fn remembering_twice_keeps_one_entry() {
        let directory = scratch("dedupe");
        remember(&directory, "/home/a", "none").expect("written");
        remember(&directory, "/home/a", "none").expect("written");
        let record: Record =
            serde_json::from_str(&fs::read_to_string(directory.join(FILE)).unwrap()).unwrap();
        assert_eq!(record.declined.len(), 1);
        let _ = fs::remove_dir_all(&directory);
    }

    #[test]
    fn approving_a_takeover_forgets_the_earlier_no_for_that_home_only() {
        let directory = scratch("forget");
        remember(&directory, "/home/a", "none").expect("written");
        remember(&directory, "/home/b", "none").expect("written");
        forget(&directory, "/home/a").expect("forgotten");
        assert!(!remembered(&directory, "/home/a", "none"));
        assert!(remembered(&directory, "/home/b", "none"));
        // Forgetting what was never remembered is not an error and writes nothing new.
        forget(&directory, "/home/never").expect("a no-op");
        let _ = fs::remove_dir_all(&directory);
    }

    #[test]
    fn a_corrupt_record_reads_as_nothing_remembered_and_is_replaced() {
        // Asking again is the safe direction: the failure mode of a bad file is the old prompt,
        // never a takeover or a silent guest decision nobody made.
        let directory = scratch("corrupt");
        fs::create_dir_all(&directory).unwrap();
        fs::write(directory.join(FILE), "{ not json").unwrap();
        assert!(!remembered(&directory, "/home/a", "none"));
        remember(&directory, "/home/a", "none").expect("replaced");
        assert!(remembered(&directory, "/home/a", "none"));
        let _ = fs::remove_dir_all(&directory);
    }

    #[test]
    fn the_file_is_bounded_and_the_oldest_decision_goes_first() {
        let directory = scratch("cap");
        for index in 0..(MAX_ENTRIES + 3) {
            remember(&directory, &format!("/home/{index}"), "none").expect("written");
        }
        assert!(!remembered(&directory, "/home/0", "none"));
        assert!(!remembered(&directory, "/home/2", "none"));
        assert!(remembered(&directory, "/home/3", "none"));
        assert!(remembered(
            &directory,
            &format!("/home/{}", MAX_ENTRIES + 2),
            "none"
        ));
        let _ = fs::remove_dir_all(&directory);
    }

    #[test]
    fn a_write_leaves_no_staging_file_behind() {
        let directory = scratch("staging");
        remember(&directory, "/home/a", "none").expect("written");
        let names: Vec<_> = fs::read_dir(&directory)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names, vec![FILE.to_owned()]);
        let _ = fs::remove_dir_all(&directory);
    }
}
