import { Sphere, GameStatus } from '../../types.js';
import { ARENA_WIDTH, ARENA_HEIGHT, FRICTION, WALL_DAMPING, ELASTICITY } from '../../constants.js';

// Removed UI side effects from backend physics loop (logs, sounds, text-to-speech)
// We will emit events for the frontend to handle these.

export interface BackendPhysicsContext {
    currentSpheres: Sphere[];
    gameStatus: GameStatus;
    setGameStatus: (status: GameStatus) => void;
    onEvent: (event: any) => void;
}

export const updateServerPhysicsEngine = (dt: number, context: BackendPhysicsContext) => {
    const { currentSpheres, gameStatus, setGameStatus, onEvent } = context;

    if (gameStatus !== GameStatus.PLAYING) return;

    let nextSpheres = [...currentSpheres.map(s => ({ ...s }))];

    // Movement
    nextSpheres.forEach(sphere => {
        sphere.x += sphere.vx * dt;
        sphere.y += sphere.vy * dt;
        sphere.vx *= Math.pow(FRICTION, dt / (1000 / 60));
        sphere.vy *= Math.pow(FRICTION, dt / (1000 / 60));
    });

    for (let i = 0; i < nextSpheres.length; i++) {
        let s = nextSpheres[i];

        // Wall collisions
        if (s.x - s.radius < 0) { s.x = s.radius; s.vx *= -WALL_DAMPING; }
        if (s.x + s.radius > ARENA_WIDTH) { s.x = ARENA_WIDTH - s.radius; s.vx *= -WALL_DAMPING; }
        if (s.y - s.radius < 0) { s.y = s.radius; s.vy *= -WALL_DAMPING; }
        if (s.y + s.radius > ARENA_HEIGHT) { s.y = ARENA_HEIGHT - s.radius; s.vy *= -WALL_DAMPING; }

        for (let j = i + 1; j < nextSpheres.length; j++) {
            let s2 = nextSpheres[j];
            const dx = s2.x - s.x;
            const dy = s2.y - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = s.radius + s2.radius;

            if (dist < minDist) {
                // Resolution
                const overlap = minDist - dist;
                const dirX = dx / dist;
                const dirY = dy / dist;

                const m1 = s.mass;
                const m2 = s2.mass;
                const totalMass = m1 + m2;
                const r1 = m2 / totalMass;
                const r2 = m1 / totalMass;

                s.x -= dirX * overlap * r1;
                s.y -= dirY * overlap * r1;
                s2.x += dirX * overlap * r2;
                s2.y += dirY * overlap * r2;

                const rvx = s2.vx - s.vx;
                const rvy = s2.vy - s.vy;
                const velAlongNormal = rvx * dirX + rvy * dirY;

                if (velAlongNormal < 0) {
                    const e = ELASTICITY;
                    const jImpulse = -(1 + e) * velAlongNormal / (1 / m1 + 1 / m2);

                    const impulseX = jImpulse * dirX;
                    const impulseY = jImpulse * dirY;

                    s.vx -= impulseX / m1;
                    s.vy -= impulseY / m1;
                    s2.vx += impulseX / m2;
                    s2.vy += impulseY / m2;

                    // Damage calculation
                    const impactForce = Math.abs(jImpulse);
                    if (impactForce > 50) {
                        const damage = impactForce * 0.05;
                        s.health -= damage;
                        s2.health -= damage;
                        s.damageTaken += damage;
                        s2.damageTaken += damage;

                        onEvent({ type: 'collision', force: impactForce, s1: s.id, s2: s2.id, location: { x: (s.x + s2.x) / 2, y: (s.y + s2.y) / 2 } });
                    }
                }
            }
        }

        if (s.health <= 0) {
            s.isEliminated = true;
            onEvent({ type: 'eliminated', target: s.name, targetId: s.id });
        }
    }

    const aliveOld = currentSpheres.filter(s => !s.isEliminated).length;
    nextSpheres = nextSpheres.filter(s => !s.isEliminated);
    const aliveNew = nextSpheres.length;

    if (aliveOld > 1 && aliveNew <= 1) {
        setGameStatus(GameStatus.FINISHED);
        if (aliveNew === 1) {
            onEvent({ type: 'win', winner: nextSpheres[0].name });
        } else {
            onEvent({ type: 'draw' });
        }
    }

    // Assign back
    context.currentSpheres = nextSpheres;
};
