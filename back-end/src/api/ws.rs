use std::sync::atomic::{AtomicUsize, Ordering};
use crate::{
    db::{courses as course_db},
    services::ws_server::{AttendanceServer, Connect, Disconnect, WsMessage},
    AppState,
};
use actix::{Actor, ActorContext, ActorFutureExt, Addr, AsyncContext, ContextFutureSpawner, StreamHandler, WrapFuture};
use actix_web::{get, web, Error, HttpRequest, HttpResponse};
use actix_web_actors::ws;
use std::time::{Duration, Instant};
use uuid::Uuid;

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);
static NEXT_SESSION_ID: AtomicUsize = AtomicUsize::new(1);

// The WebSocket Actor Session
struct WsSession {
    id: usize, // Unique session id (can just be random)
    hb: Instant, // Last heartbeat received
    addr: Addr<AttendanceServer>, // Address of the central server actor
    course_id: Uuid, // Which course this session is interested in
}

impl WsSession {
    // Helper to send heartbeat pings
    fn hb(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                log::info!("WebSocket Client heartbeat failed for course {}, disconnecting!", act.course_id);
                act.addr.do_send(Disconnect { session_id: act.id, course_id: act.course_id });
                ctx.stop();
                return;
            }
            ctx.ping(b"");
        });
    }
}

impl Actor for WsSession {
    type Context = ws::WebsocketContext<Self>;

    // Called when actor starts
    fn started(&mut self, ctx: &mut Self::Context) {
        log::info!("WebSocket session started for course {}", self.course_id);
        self.hb(ctx); // Start heartbeat process

        let addr = ctx.address();
        self.addr
            .send(Connect {
                addr: addr.recipient(), // Send Recipient address
                course_id: self.course_id,
                session_id: self.id,
            })
            .into_actor(self)
            .then(|res, _act, ctx| {
                match res {
                    Ok(initial_count) => {
                        log::info!("WS Session {} connected. Initial count for {}: {}", _act.id, _act.course_id, initial_count);
                        // Send initial count to the client upon connection
                        let msg = serde_json::json!({
                               "type": "attendance_update",
                               "presentCount": initial_count
                           });
                        ctx.text(serde_json::to_string(&msg).unwrap_or_default());
                    }
                    _ => {
                        log::error!("Failed to connect WebSocket session to server actor.");
                        ctx.stop()
                    }, // Something went wrong connecting to the server actor
                }
                actix::fut::ready(())
            })
            .wait(ctx);
    }

    // Called when actor stops
    fn stopping(&mut self, _: &mut Self::Context) -> actix::Running {
        log::info!("WebSocket session stopping for course {}", self.course_id);
        self.addr.do_send(Disconnect { session_id: self.id, course_id: self.course_id });
        actix::Running::Stop
    }
}

// Handler for incoming WebSocket messages from the client
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => {
                self.hb = Instant::now();
                ctx.pong(&msg);
            }
            Ok(ws::Message::Pong(_)) => {
                self.hb = Instant::now();
            }
            Ok(ws::Message::Text(text)) => {
                // We generally don't expect text messages *from* the dashboard client
                log::debug!("WS Received Text: {}", text);
                // Can optionally handle messages here if needed later
            }
            Ok(ws::Message::Binary(_)) => log::warn!("WS Received unexpected binary"),
            Ok(ws::Message::Close(reason)) => {
                log::info!("WS Client closed connection: {:?}", reason);
                ctx.close(reason);
                ctx.stop();
            }
            Ok(ws::Message::Continuation(_)) => {
                log::warn!("WS Received continuation frame, ignoring");
                // ctx.stop();
            }
            Ok(ws::Message::Nop) => (),
            Err(e) => {
                log::error!("WebSocket error: {}", e);
                ctx.stop()
            }, // Protocol error, stop the session
        }
    }
}

// Handler for messages sent *to* this session *from* the AttendanceServer actor
impl actix::Handler<WsMessage> for WsSession {
    type Result = ();

    fn handle(&mut self, msg: WsMessage, ctx: &mut Self::Context) {
        // Forward the message content (which should be JSON) to the connected client
        ctx.text(msg.0);
    }
}


// Entry point for WebSocket connection requests
#[get("/ws/{course_id}")]
async fn ws_index(
    req: HttpRequest,
    stream: web::Payload,
    path: web::Path<Uuid>,
    state: web::Data<AppState>, // Get access to AppState
) -> Result<HttpResponse, Error> {
    let course_id = path.into_inner();
    log::info!("WebSocket upgrade request for course_id: {}", course_id);

    // Verify course exists before upgrading
    if course_db::fetch_course_by_id(&state.db_pool, course_id).await.is_err() {
        log::error!("Attempted WebSocket connection for non-existent course ID: {}", course_id);
        return Ok(HttpResponse::NotFound().body("Course not found"));
    }

    // --- Use Atomic Counter for ID ---
    let session_id = NEXT_SESSION_ID.fetch_add(1, Ordering::SeqCst);
    log::info!("Assigning session ID: {}", session_id);

    let session = WsSession {
        id: session_id, // Generate a random session ID
        hb: Instant::now(),
        addr: state.ws_server.clone(), // Clone the Addr
        course_id,
    };

    // Upgrade the HTTP connection to WebSocket
    ws::start(session, &req, stream)
}

// Host-only config because only dashboard connects to WS
pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(ws_index);
}