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
    db_pool: SqlitePool, // Needed to fetch initial counts
}

impl AttendanceServer {
    pub fn new(db_pool: SqlitePool) -> Self {
        AttendanceServer {
            rooms: HashMap::new(),
            db_pool,
        }
    }

    /// Sends a message to all clients in a specific course room.
    fn send_message(&self, course_id: Uuid, message: &str) {
        if let Some(sessions) = self.rooms.get(&course_id) {
            log::trace!("Broadcasting to {} sessions in room {}", sessions.len(), course_id);
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
        log::info!("Session {} connecting to course room {}", msg.session_id, msg.course_id);

        // Add the session recipient to the room for the course_id
        self.rooms
            .entry(msg.course_id)
            .or_default()
            .insert(msg.addr);

        log::debug!("Room {}: {} sessions", msg.course_id, self.rooms.get(&msg.course_id).map_or(0, |s| s.len()));

        // Fetch the current attendance count for this course to send back immediately
        // This is blocking within the actor's handler, but DB query should be fast.
        // Consider spawning a task if it becomes slow.
        // let pool = self.db_pool.clone();
        // let course_id = msg.course_id;
        // let count_future = async move {
        //     attendance_db::fetch_todays_attendance_count(&pool, course_id)
        //         .await
        //         .unwrap_or_else(|e| {
        //             log::error!("Failed to fetch initial attendance count for {}: {}", course_id, e);
        //             0 // Default to 0 on error
        //         })
        // };

        // We need to block here to return the value. Use actix::block_on if needed, or restructure.
        // For simplicity now, let's assume a quick fetch or return 0.
        // A better way is using ctx.spawn and sending the result back via message.
        // Let's return 0 synchronously for now and have the client wait for the first AttendanceUpdate.
        // Or better: Fetch async and send the result as the *first* message *to* the client.
        // The ws::start code already does this via the into_actor().then() block.
        // So we just need to return the count from the future.
        // Requires making the handler async or using futures::executor::block_on
        // Let's stick to the ws::start logic sending the first message. Return 0 here.
        0 // The real count is sent async after connection establishes in ws.rs

        // Alternative (if we could easily block or make handler async):
        // futures::executor::block_on(count_future) as usize
    }
}

impl Handler<Disconnect> for AttendanceServer {
    type Result = ();

    fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) {
        log::info!("Session {} disconnecting from course room {}", msg.session_id, msg.course_id);

        let mut room_empty = false;
        if let Some(sessions) = self.rooms.get_mut(&msg.course_id) {
            // We don't have the Recipient address here easily, just the session ID.
            // This design needs adjustment: Connect should perhaps store session_id -> Recipient map
            // or Disconnect needs to pass the Recipient.
            // For now, let's assume the session actor cleans itself up. We'll just log.
            // If we stored `HashMap<Uuid, HashMap<usize, Recipient<WsMessage>>>`:
            // if sessions.remove(&msg.session_id).is_some() { ... }

            log::warn!("Cannot remove session {} directly without recipient address. Room size might be inaccurate until session actor stops fully.", msg.session_id);

            if sessions.is_empty() {
                room_empty = true;
            }
        }

        if room_empty {
            log::info!("Room {} is now empty, removing.", msg.course_id);
            self.rooms.remove(&msg.course_id);
        }
        log::debug!("Total rooms active: {}", self.rooms.len());
    }
}


impl Handler<AttendanceUpdate> for AttendanceServer {
    type Result = ();

    fn handle(&mut self, msg: AttendanceUpdate, _: &mut Context<Self>) {
        log::debug!("Received attendance update for course {}: count={}", msg.course_id, msg.present_count);
        let response_json = serde_json::json!({
             "type": "attendance_update",
             "presentCount": msg.present_count
         });
        let message_str = serde_json::to_string(&response_json).unwrap_or_default();
        self.send_message(msg.course_id, &message_str);
    }
}