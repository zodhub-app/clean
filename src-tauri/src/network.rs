use serde::Serialize;
use std::process::Command;
use sysinfo::Networks;

#[derive(Serialize)]
pub struct NetworkStats {
    /// Cumulative bytes/packets received/transmitted across all interfaces.
    /// The frontend diffs these between polls to get per-second rates.
    rx_total: u64,
    tx_total: u64,
    pkt_rx_total: u64,
    pkt_tx_total: u64,
    /// Real socket counts (best-effort, via `netstat`). 0 if it can't be read.
    established: u32,
    listening: u32,
}

#[tauri::command]
pub fn network_stats() -> NetworkStats {
    let nets = Networks::new_with_refreshed_list();
    let mut rx = 0u64;
    let mut tx = 0u64;
    let mut prx = 0u64;
    let mut ptx = 0u64;
    for (_name, data) in &nets {
        rx += data.total_received();
        tx += data.total_transmitted();
        prx += data.total_packets_received();
        ptx += data.total_packets_transmitted();
    }

    let (established, listening) = count_sockets();

    NetworkStats {
        rx_total: rx,
        tx_total: tx,
        pkt_rx_total: prx,
        pkt_tx_total: ptx,
        established,
        listening,
    }
}

/// Counts ESTABLISHED and LISTEN sockets from `netstat -an`. macOS ships netstat.
/// Any failure (missing binary, parse error) degrades gracefully to (0, 0).
fn count_sockets() -> (u32, u32) {
    let output = match Command::new("netstat").args(["-an"]).output() {
        Ok(o) => o,
        Err(_) => return (0, 0),
    };
    let text = String::from_utf8_lossy(&output.stdout);
    let mut established = 0u32;
    let mut listening = 0u32;
    for line in text.lines() {
        if line.contains("ESTABLISHED") {
            established += 1;
        } else if line.contains("LISTEN") {
            listening += 1;
        }
    }
    (established, listening)
}
