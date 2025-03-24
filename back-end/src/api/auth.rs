use actix_web::{post, web, HttpResponse, cookie::{Cookie, SameSite}};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use bcrypt::{verify, DEFAULT_COST};
use jsonwebtoken::{encode, Header, EncodingKey};
use chrono::{Utc, Duration};
use crate::models::user::User;
use crate::utils::error::Error;

#[derive(Deserialize)]
pub struct LoginRequest {
    username: String,
    password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    success: bool,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    token: Option<String>,
}

#[derive(Serialize)]
struct Claims {
    sub: String,       // Subject (user id)
    exp: usize,        // Expiration time
    iat: usize,        // Issued at
}

// Login route
#[post("/auth/login")]
pub async fn login(
    login_data: web::Json<LoginRequest>,
    db: web::Data<SqlitePool>,
    config: web::Data<crate::config::Config>,
) -> Result<HttpResponse, Error> {
    let user_data = login_data.into_inner();

    // Find user by username
    let user_result = sqlx::query_as!(
        User,
        "SELECT id, username, password_hash, created_at FROM users WHERE username = ?",
        user_data.username
    )
        .fetch_optional(&**db)
        .await?;

    let user = match user_result {
        Some(user) => user,
        None => {
            return Ok(HttpResponse::Unauthorized().json(LoginResponse {
                success: false,
                message: "Invalid username or password".to_string(),
                token: None,
            }));
        }
    };

    // Verify password
    let password_matches = verify(&user_data.password, &user.password_hash).unwrap_or(false);
    if !password_matches {
        return Ok(HttpResponse::Unauthorized().json(LoginResponse {
            success: false,
            message: "Invalid username or password".to_string(),
            token: None,
        }));
    }

    // Generate JWT token
    let now = Utc::now();
    let exp = (now + Duration::hours(24)).timestamp() as usize;
    let claims = Claims {
        sub: user.id.to_string(),
        exp,
        iat: now.timestamp() as usize,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
    )?;

    // Create auth cookie
    let cookie = Cookie::build("auth_token", token.clone())
        .path("/")
        .same_site(SameSite::Strict)
        .http_only(true)
        .max_age(actix_web::cookie::time::Duration::hours(24))
        .finish();

    Ok(HttpResponse::Ok()
        .cookie(cookie)
        .json(LoginResponse {
            success: true,
            message: "Login successful".to_string(),
            token: Some(token),
        }))
}

// Logout route
#[post("/auth/logout")]
pub async fn logout() -> HttpResponse {
    // Create empty cookie with immediate expiration to clear the auth cookie
    let cookie = Cookie::build("auth_token", "")
        .path("/")
        .max_age(actix_web::cookie::time::Duration::seconds(0))
        .http_only(true)
        .finish();

    HttpResponse::Ok()
        .cookie(cookie)
        .json(serde_json::json!({
            "success": true,
            "message": "Logged out successfully"
        }))
}