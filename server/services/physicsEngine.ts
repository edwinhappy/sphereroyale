import { Sphere, GameStatus } from '../../types.js';
import { ARENA_WIDTH, ARENA_HEIGHT, FRICTION, WALL_DAMPING, ELASTICITY } from '../../constants.js';

export interface BackendPhysicsContext {
    currentSpheres: Sphere[];
    gameStatus: GameStatus;
    setGameStatus: (status: GameStatus) => void;
    onEvent: (event: any) => void;
}

const EPSILON = 1e-6;

export const updateServerPhysicsEngine = (dtMs: number, context: BackendPhysicsContext) => {
    const { currentSpheres, gameStatus, setGameStatus, onEvent } = context;

    if (gameStatus !== GameStatus.PLAYING || !Number.isFinite(dtMs) || dtMs <= 0) return;

    let nextSpheres = currentSpheres.map(s => ({ ...s }));

    // Movement
    nextSpheres.forEach(sphere => {
        sphere.x += sphere.vx * dtMs;
        sphere.y += sphere.vy * dtMs;
        sphere.vx *= Math.pow(FRICTION, dtMs / (1000 / 60));
        sphere.vy *= Math.pow(FRICTION, dtMs / (1000 / 60));
    });

    for (let i = 0; i < nextSpheres.length; i++) {
        const s = nextSpheres[i];

        if (s.x - s.radius < 0) { s.x = s.radius; s.vx *= -WALL_DAMPING; }
        if (s.x + s.radius > ARENA_WIDTH) { s.x = ARENA_WIDTH - s.radius; s.vx *= -WALL_DAMPING; }
        if (s.y - s.radius < 0) { s.y = s.radius; s.vy *= -WALL_DAMPING; }
        if (s.y + s.radius > ARENA_HEIGHT) { s.y = ARENA_HEIGHT - s.radius; s.vy *= -WALL_DAMPING; }

        for (let j = i + 1; j < nextSpheres.length; j++) {
            const s2 = nextSpheres[j];
            const dx = s2.x - s.x;
            const dy = s2.y - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = s.radius + s2.radius;

            if (dist < minDist) {
                const safeDist = dist > EPSILON ? dist : minDist;
                const overlap = minDist - safeDist;

                // Guard for perfect overlap to avoid NaN normals.
                const dirX = dist > EPSILON ? dx / safeDist : (Math.random() > 0.5 ? 1 : -1);
                const dirY = dist > EPSILON ? dy / safeDist : 0;

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
                    const jImpulse = -(1 + ELASTICITY) * velAlongNormal / (1 / m1 + 1 / m2);

                    const impulseX = jImpulse * dirX;
                    const impulseY = jImpulse * dirY;

                    s.vx -= impulseX / m1;
                    s.vy -= impulseY / m1;
                    s2.vx += impulseX / m2;
                    s2.vy += impulseY / m2;

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
        onEvent(aliveNew === 1 ? { type: 'win', winner: nextSpheres[0].name } : { type: 'draw' });
    }

    context.currentSpheres = nextSpheres;
};
