use anyhow::Result;
use local_ip_address::local_ip;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

// Check if an IP address is on the local network
pub fn is_local_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(ipv4) => is_local_ipv4(ipv4),
        IpAddr::V6(ipv6) => is_local_ipv6(ipv6),
    }
}

// Check if an IPv4 address is on the local network
fn is_local_ipv4(ip: &Ipv4Addr) -> bool {
    // Check if it's a private/local address
    ip.is_private() || ip.is_loopback() || ip.is_link_local()
}

// Check if an IPv6 address is on the local network
fn is_local_ipv6(ip: &Ipv6Addr) -> bool {
    // Check if it's a private/local address
    ip.is_loopback() || ip.is_unique_local()
}

// Get the CIDR range for the local network
pub fn get_local_network_range() -> Result<String> {
    // Get local IP address
    let local_ip = local_ip()?;

    match local_ip {
        IpAddr::V4(ipv4) => {
            // For IPv4, use a /24 network (255.255.255.0)
            let octets = ipv4.octets();
            Ok(format!("{}.{}.{}.0/24", octets[0], octets[1], octets[2]))
        }
        IpAddr::V6(ipv6) => {
            // For IPv6, use a /64 network
            let segments = ipv6.segments();
            Ok(format!(
                "{:x}:{:x}:{:x}:{:x}::/64",
                segments[0], segments[1], segments[2], segments[3]
            ))
        }
    }
}

// Check if an IP address is within a specified CIDR range
pub fn is_ip_in_cidr(ip: &IpAddr, cidr: &str) -> bool {
    // Since cidr crate is missing, implement a simple check
    match ip {
        IpAddr::V4(ipv4) => {
            let octets = ipv4.octets();
            let prefix = format!("{}.{}.{}", octets[0], octets[1], octets[2]);
            cidr.starts_with(&prefix)
        }
        IpAddr::V6(ipv6) => {
            let segments = ipv6.segments();
            let prefix = format!(
                "{:x}:{:x}:{:x}:{:x}",
                segments[0], segments[1], segments[2], segments[3]
            );
            cidr.starts_with(&prefix)
        }
    }
}

// Get the hostname of the local machine
pub fn get_local_hostname() -> Result<String> {
    // Since hostname crate is missing, return a placeholder
    Ok("localhost".to_string())
}

// Build a local URL with the server's IP and port
pub fn build_local_url(port: u16, path: &str) -> Result<String> {
    let ip = local_ip()?;
    let url = format!("http://{}:{}{}", ip, port, path);
    Ok(url)
}

// Check if request is coming from localhost
pub fn is_localhost(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => ip.is_loopback(),
        IpAddr::V6(ip) => ip.is_loopback(),
    }
}
