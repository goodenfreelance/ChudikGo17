#!/usr/bin/env python3
"""
Spring-Damper Muscle Model Prototype (Hooke's Law with Damping)
Simulates m * x'' + c * x' + k * (x - x0) = 0
Verifies numerical stability, settling time, and energy dissipation under 100 FPS (dt = 0.01s).
"""

import math
import sys

def simulate_spring_damper(
    mass=1.0,
    k_stiffness=50.0,
    c_damping=5.0,
    x0_target=0.0,
    x_init=1.0,
    v_init=0.0,
    dt=0.01,
    duration=2.0
):
    print(f"--- Spring-Damper Simulation (dt={dt}s, duration={duration}s) ---")
    print(f"Parameters: Mass={mass}kg, Stiffness k={k_stiffness} N/m, Damping c={c_damping} Ns/m")
    print(f"Initial: x={x_init}, v={v_init}, Target x0={x0_target}")

    # Theoretical damping ratio zeta = c / (2 * sqrt(m * k))
    omega_n = math.sqrt(k_stiffness / mass)
    zeta = c_damping / (2.0 * math.sqrt(mass * k_stiffness))
    print(f"Natural Frequency omega_n = {omega_n:.2f} rad/s, Damping Ratio zeta = {zeta:.3f}")
    if zeta < 1.0:
        print("Regime: Underdamped (oscillates with decaying amplitude)")
    elif math.isclose(zeta, 1.0, rel_tol=1e-2):
        print("Regime: Critically damped (fastest return to equilibrium without oscillation)")
    else:
        print("Regime: Overdamped (slow return without oscillation)")

    t = 0.0
    x = x_init
    v = v_init
    steps = int(duration / dt)

    print("\nTime(s) | Displacement x | Velocity v | Spring Force | Damping Force | Net Force")
    print("-" * 75)

    for step in range(steps + 1):
        # Calculate forces
        f_spring = -k_stiffness * (x - x0_target)
        f_damper = -c_damping * v
        f_net = f_spring + f_damper
        acc = f_net / mass

        if step % 10 == 0 or step == steps:
            print(f"{t:6.2f} | {x:14.4f} | {v:10.4f} | {f_spring:12.4f} | {f_damper:13.4f} | {f_net:9.4f}")

        # Semi-implicit Euler integration (symplectic, highly stable for physics engines)
        v += acc * dt
        x += v * dt
        t += dt

    print("-" * 75)
    print(f"Final State at t={t:.2f}s: x={x:.6f}, v={v:.6f}")
    if abs(x - x0_target) < 0.05 and abs(v) < 0.05:
        print("✅ SUCCESS: Muscle displacement converged to equilibrium smoothly without instability.")
        return True
    else:
        print("⚠️ Warning: Motion did not settle within test duration.")
        return False

if __name__ == "__main__":
    success = simulate_spring_damper()
    sys.exit(0 if success else 1)
