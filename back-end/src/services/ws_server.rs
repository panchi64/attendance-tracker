use actix::{Actor, Context, Handler, Message, Recipient};
use sqlx::SqlitePool;
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

// --- Messages ---

/// Message sent from a WsSession actor to the AttendanceServer when it connects.
#[derive(Message)]
#[rtype(result = "usize")] // Returns the initial attendance count for the course
pub struct Connect {
    pub addr: Recipient<WsMessage>, // Address of the WsSession actor
    pub course_id: Uuid,
    pub session_id: usize,
}

/// Message sent from a WsSession actor when it disconnects.
#[derive(Message)]
#[rtype(result = "()")]
pub struct Disconnect {
    pub session_id: usize,
    pub course_id: Uuid, // Include course_id to find the right room
}

/// Message containing the actual data broadcast to clients (JSON string).
#[derive(Message, Clone)] // Cloneable so we can send copies
#[rtype(result = "()")]
pub struct WsMessage(pub String);

/// Message sent from HTTP handlers (e.g., attendance submission) to trigger an update broadcast.
#[derive(Message)]
#[rtype(result = "()")]
pub struct AttendanceUpdate {
    pub course_id: Uuid,
    pub present_count: usize,
}

// --- Actor Definition ---

/// The central server actor managing WebSocket connections grouped by course.
#[derive(Debug)]
pub struct AttendanceServer {
    // Map course_id to a set of connected session recipients
    rooms: HashMap<Uuid, HashSet<Recipient<WsMessage>>>,
    // Map course_id to a map of session_id -> recipient for efficient disconnection
    sessions: HashMap<Uuid, HashMap<usize, Recipient<WsMessage>>>,
}

impl AttendanceServer {
    pub fn new(_db_pool: SqlitePool) -> Self {
        AttendanceServer {
            rooms: HashMap::new(),
            sessions: HashMap::new(),
        }
    }

    /// Sends a message to all clients in a specific course room.
    fn send_message(&self, course_id: Uuid, message: &str) {
        if let Some(sessions) = self.rooms.get(&course_id) {
            log::trace!(
                "Broadcasting to {} sessions in room {}",
                sessions.len(),
                course_id
            );
            for recipient in sessions {
                recipient.do_send(WsMessage(message.to_owned()));
            }
        } else {
            log::trace!("No sessions found in room {} to broadcast to", course_id);
        }
    }
}

impl Actor for AttendanceServer {
    type Context = Context<Self>;

    fn started(&mut self, _ctx: &mut Context<Self>) {
        log::info!("AttendanceServer Actor started.");
    }

    fn stopped(&mut self, _ctx: &mut Context<Self>) {
        log::info!("AttendanceServer Actor stopped.");
    }
}

// --- Message Handlers ---

impl Handler<Connect> for AttendanceServer {
    type Result = usize; // Return initial count

    fn handle(&mut self, msg: Connect, _ctx: &mut Context<Self>) -> Self::Result {
        log::info!(
            "Session {} connecting to course room {}",
            msg.session_id,
            msg.course_id
        );

        // Add the session recipient to the room for the course_id
        self.rooms
            .entry(msg.course_id)
            .or_default()
            .insert(msg.addr.clone());

        // Add the session recipient to the sessions map for efficient disconnection
        self.sessions
            .entry(msg.course_id)
            .or_default()
            .insert(msg.session_id, msg.addr);

        log::debug!(
            "Room {}: {} sessions",
            msg.course_id,
            self.rooms.get(&msg.course_id).map_or(0, |s| s.len())
        );

        // The real count is sent async after connection establishes in ws.rs
        0
    }
}

impl Handler<Disconnect> for AttendanceServer {
    type Result = ();

    fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) {
        log::info!(
            "Session {} disconnecting from course room {}",
            msg.session_id,
            msg.course_id
        );

        // Check if this session exists in our sessions map
        let mut session_removed = false;
        if let Some(course_sessions) = self.sessions.get_mut(&msg.course_id) {
            // If we found the session in our map, get its recipient
            if let Some(recipient) = course_sessions.remove(&msg.session_id) {
                // Remove the recipient from the rooms HashSet
                if let Some(room) = self.rooms.get_mut(&msg.course_id) {
                    room.remove(&recipient);
                    session_removed = true;
                    log::info!(
                        "Removed session {} from room {}",
                        msg.session_id,
                        msg.course_id
                    );
                }
            }

            // Check if the course room is now empty
            if course_sessions.is_empty() {
                // Mark for removal from rooms map
                self.rooms.remove(&msg.course_id);
                log::info!("Room {} is now empty, removing.", msg.course_id);
            }
        }

        if !session_removed {
            log::warn!(
                "Session {} not found in session map for course {}. May already be removed.",
                msg.session_id,
                msg.course_id
            );
        }

        // Remove empty course from sessions map
        if let Some(course_sessions) = self.sessions.get(&msg.course_id) {
            if course_sessions.is_empty() {
                self.sessions.remove(&msg.course_id);
            }
        }

        log::debug!("Total active rooms: {}", self.rooms.len());
    }
}

impl Handler<AttendanceUpdate> for AttendanceServer {
    type Result = ();

    fn handle(&mut self, msg: AttendanceUpdate, _: &mut Context<Self>) {
        log::debug!(
            "Received attendance update for course {}: count={}",
            msg.course_id,
            msg.present_count
        );
        let response_json = serde_json::json!({
            "type": "attendance_update",
            "presentCount": msg.present_count
        });
        let message_str = serde_json::to_string(&response_json).unwrap_or_default();
        self.send_message(msg.course_id, &message_str);
    }
}
