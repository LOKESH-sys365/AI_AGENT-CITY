"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  MathUtils,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
} from "three";
import { AGENTS, AgentId } from "@/lib/agents";

const agentIds = Object.keys(AGENTS) as AgentId[];

const buildings: Record<
  AgentId,
  {
    position: [number, number];
    width: number;
    depth: number;
    height: number;
    wall: string;
    roof: string;
  }
> = {
  mayor: {
    position: [0, 0],
    width: 2.4,
    depth: 2.2,
    height: 5.4,
    wall: "#A7664F",
    roof: "#32363D",
  },
  librarian: {
    position: [-5.2, -4.1],
    width: 2.1,
    depth: 1.9,
    height: 4.35,
    wall: "#A45543",
    roof: "#34363C",
  },
  professor: {
    position: [5.2, -4.1],
    width: 2.1,
    depth: 1.9,
    height: 5.8,
    wall: "#877B70",
    roof: "#3A4149",
  },
  builder: {
    position: [-5.2, 4.1],
    width: 2.1,
    depth: 1.9,
    height: 4.7,
    wall: "#985B49",
    roof: "#35343A",
  },
  planner: {
    position: [5.2, 4.1],
    width: 2.1,
    depth: 1.9,
    height: 5.1,
    wall: "#B08D6B",
    roof: "#3B444B",
  },
};

const treeLocations: [number, number][] = [
  [-8.8, -6.7],
  [-8.8, -2.2],
  [-8.8, 2.2],
  [-8.8, 6.7],
  [8.8, -6.7],
  [8.8, -2.2],
  [8.8, 2.2],
  [8.8, 6.7],
  [-3.1, -7.5],
  [3.1, -7.5],
  [-3.1, 7.5],
  [3.1, 7.5],
];

function Window({
  position,
  rotationY = 0,
  lit,
}: {
  position: [number, number, number];
  rotationY?: number;
  lit: boolean;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh>
        <boxGeometry args={[0.42, 0.62, 0.09]} />
        <meshStandardMaterial color="#292C30" roughness={0.78} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[0.32, 0.51, 0.025]} />
        <meshStandardMaterial
          color={lit ? "#FFD891" : "#26394D"}
          emissive={lit ? "#F3A94F" : "#294461"}
          emissiveIntensity={lit ? 1.05 : 0.16}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <boxGeometry args={[0.025, 0.51, 0.025]} />
        <meshStandardMaterial color="#292C30" />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <boxGeometry args={[0.32, 0.025, 0.025]} />
        <meshStandardMaterial color="#292C30" />
      </mesh>
    </group>
  );
}

function FireEscape({ floors, depth }: { floors: number; depth: number }) {
  const iron = "#25292E";

  return (
    <group position={[-0.58, 0, depth / 2 + 0.12]}>
      {Array.from({ length: floors }, (_, floor) => {
        const y = 0.72 + floor * 0.9;

        return (
          <group key={floor} position={[0, y, 0]}>
            <mesh position={[0, 0, 0.16]} castShadow>
              <boxGeometry args={[0.72, 0.08, 0.46]} />
              <meshStandardMaterial color={iron} metalness={0.62} roughness={0.58} />
            </mesh>
            {[-0.32, 0.32].map((x) => (
              <mesh key={x} position={[x, 0.28, 0.34]} castShadow>
                <boxGeometry args={[0.035, 0.55, 0.035]} />
                <meshStandardMaterial color={iron} metalness={0.62} roughness={0.58} />
              </mesh>
            ))}
            <mesh position={[0, 0.55, 0.34]}>
              <boxGeometry args={[0.68, 0.035, 0.035]} />
              <meshStandardMaterial color={iron} metalness={0.62} roughness={0.58} />
            </mesh>
          </group>
        );
      })}
      {Array.from({ length: floors - 1 }, (_, floor) => (
        <group key={`stairs-${floor}`} position={[0, 1.12 + floor * 0.9, 0.4]}>
          <mesh position={[0, 0, 0]} rotation={[0, 0, 0.48]} castShadow>
            <boxGeometry args={[0.055, 0.92, 0.055]} />
            <meshStandardMaterial color={iron} metalness={0.62} roughness={0.58} />
          </mesh>
          {Array.from({ length: 5 }, (_, step) => (
            <mesh
              key={step}
              position={[-0.22 + step * 0.11, 0.33 - step * 0.15, 0]}
            >
              <boxGeometry args={[0.19, 0.035, 0.17]} />
              <meshStandardMaterial color={iron} metalness={0.62} roughness={0.58} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function WaterTower({ height }: { height: number }) {
  return (
    <group position={[0.35, height + 0.4, -0.25]}>
      {[-0.25, 0.25].flatMap((x) =>
        [-0.25, 0.25].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.33, z]} castShadow>
            <boxGeometry args={[0.045, 0.7, 0.045]} />
            <meshStandardMaterial color="#353536" metalness={0.45} roughness={0.65} />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.78, 0]} castShadow>
        <cylinderGeometry args={[0.39, 0.39, 0.72, 16]} />
        <meshStandardMaterial color="#725846" roughness={0.84} />
      </mesh>
      <mesh position={[0, 1.15, 0]} castShadow>
        <coneGeometry args={[0.4, 0.13, 16]} />
        <meshStandardMaterial color="#463A32" roughness={0.82} />
      </mesh>
      {[0.48, 0.96].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <torusGeometry args={[0.39, 0.018, 6, 20]} />
          <meshStandardMaterial color="#443A34" metalness={0.55} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Building({
  id,
  selected,
  onSelect,
}: {
  id: AgentId;
  selected: boolean;
  onSelect: (id: AgentId) => void;
}) {
  const group = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const ringMaterial = useRef<MeshBasicMaterial>(null);
  const hovered = useRef(false);
  const detail = buildings[id];
  const accent = AGENTS[id].color;
  const floors = Math.max(4, Math.floor(detail.height));
  const rows = Array.from({ length: floors }, (_, floor) => 0.78 + floor * 0.9);
  const columns = detail.width > 2.2 ? [-0.68, 0, 0.68] : [-0.58, 0, 0.58];
  const buildingIndex = agentIds.indexOf(id);
  const facing = Math.atan2(-detail.position[0], -detail.position[1]);
  const baseHeight = id === "mayor" ? 0.1 : 0;
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    elapsed.current += delta;

    if (group.current) {
      const targetScale = hovered.current ? 1.02 : selected ? 1.008 : 1;
      group.current.scale.setScalar(
        MathUtils.damp(group.current.scale.x, targetScale, 7, delta),
      );
    }

    if (ring.current && ringMaterial.current) {
      const pulse = selected ? 1 + Math.sin(elapsed.current * 1.8) * 0.018 : 0.94;
      ring.current.scale.setScalar(
        MathUtils.damp(ring.current.scale.x, pulse, 6, delta),
      );
      ringMaterial.current.opacity = MathUtils.damp(
        ringMaterial.current.opacity,
        selected ? 0.52 : 0,
        6,
        delta,
      );
    }
  });

  return (
    <group
      ref={group}
      position={[detail.position[0], baseHeight, detail.position[1]]}
      rotation={[0, facing, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(id);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        hovered.current = true;
      }}
      onPointerOut={() => {
        hovered.current = false;
      }}
    >
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <ringGeometry args={[detail.width * 0.72, detail.width * 0.8, 48]} />
        <meshBasicMaterial
          ref={ringMaterial}
          color={accent}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.13, 0]} castShadow receiveShadow>
        <boxGeometry args={[detail.width + 0.32, 0.2, detail.depth + 0.32]} />
        <meshStandardMaterial color="#4E4D4A" roughness={0.92} />
      </mesh>
      <mesh position={[0, detail.height / 2 + 0.23, 0]} castShadow receiveShadow>
        <boxGeometry args={[detail.width, detail.height, detail.depth]} />
        <meshStandardMaterial color={detail.wall} roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[detail.width + 0.07, 0.12, detail.depth + 0.07]} />
        <meshStandardMaterial color="#74675C" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.37, detail.depth / 2 + 0.022]}>
        <boxGeometry args={[detail.width, 0.12, 0.055]} />
        <meshStandardMaterial color="#66574D" roughness={0.82} />
      </mesh>
      {rows.map((row) => (
        <mesh
          key={`masonry-${row}`}
          position={[0, row + 0.53, detail.depth / 2 + 0.02]}
        >
          <boxGeometry args={[detail.width + 0.04, 0.045, 0.035]} />
          <meshStandardMaterial color="#795A4B" roughness={0.9} />
        </mesh>
      ))}
      {rows.map((row, rowIndex) =>
        columns.map((column, columnIndex) => (
          <Window
            key={`front-${row}-${column}`}
            position={[column, row + 0.16, detail.depth / 2 + 0.045]}
            lit={(rowIndex * 3 + columnIndex + buildingIndex) % 4 < 2}
          />
        )),
      )}
      {rows.map((row, rowIndex) =>
        columns.map((column, columnIndex) => (
          <Window
            key={`back-${row}-${column}`}
            position={[column, row + 0.16, -detail.depth / 2 - 0.045]}
            rotationY={Math.PI}
            lit={(rowIndex * 3 + columnIndex + buildingIndex + 1) % 4 < 2}
          />
        )),
      )}
      {rows.map((row, rowIndex) =>
        [-0.42, 0.42].map((z, columnIndex) => (
          <Window
            key={`right-${row}-${z}`}
            position={[detail.width / 2 + 0.045, row + 0.16, z]}
            rotationY={Math.PI / 2}
            lit={(rowIndex * 3 + columnIndex + buildingIndex + 2) % 4 < 2}
          />
        )),
      )}
      {rows.map((row, rowIndex) =>
        [-0.42, 0.42].map((z, columnIndex) => (
          <Window
            key={`left-${row}-${z}`}
            position={[-detail.width / 2 - 0.045, row + 0.16, z]}
            rotationY={-Math.PI / 2}
            lit={(rowIndex * 3 + columnIndex + buildingIndex + 3) % 4 < 2}
          />
        )),
      )}
      <mesh position={[0, 0.72, detail.depth / 2 + 0.055]} castShadow>
        <boxGeometry args={[id === "builder" ? 0.78 : 0.46, 1.1, 0.1]} />
        <meshStandardMaterial color={id === "builder" ? "#735E50" : accent} roughness={0.72} />
      </mesh>
      <mesh position={[0.13, 0.72, detail.depth / 2 + 0.11]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#D8BF7C" metalness={0.35} roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.32, detail.depth / 2 + 0.12]} castShadow>
        <boxGeometry args={[0.86, 0.1, 0.26]} />
        <meshStandardMaterial color={detail.roof} roughness={0.8} />
      </mesh>
      {[0, 1].map((step) => (
        <mesh
          key={step}
          position={[0, 0.08 + step * 0.1, detail.depth / 2 + 0.23 + step * 0.18]}
          receiveShadow
        >
          <boxGeometry args={[0.82, 0.1, 0.28]} />
          <meshStandardMaterial color="#77726C" roughness={0.96} />
        </mesh>
      ))}
      {id === "librarian" &&
        [-0.66, 0.66].map((x) => (
          <group key={x} position={[x, 0.2, detail.depth / 2 + 0.12]}>
            <mesh position={[0, 0.78, 0]} castShadow>
              <cylinderGeometry args={[0.065, 0.08, 1.45, 10]} />
              <meshStandardMaterial color="#B9B2A6" roughness={0.84} />
            </mesh>
            <mesh position={[0, 1.54, 0]} castShadow>
              <boxGeometry args={[0.2, 0.1, 0.2]} />
              <meshStandardMaterial color="#B9B2A6" roughness={0.84} />
            </mesh>
          </group>
        ))}
      {id === "professor" && (
        <mesh position={[0, 1.42, detail.depth / 2 + 0.17]} castShadow>
          <boxGeometry args={[1.2, 0.11, 0.4]} />
          <meshStandardMaterial color="#667780" roughness={0.78} />
        </mesh>
      )}
      <>
          <mesh position={[0, detail.height + 0.31, 0]} castShadow>
            <boxGeometry args={[detail.width + 0.22, 0.18, detail.depth + 0.22]} />
            <meshStandardMaterial color={detail.roof} roughness={0.86} />
          </mesh>
          {[0, 1].map((side) => (
            <mesh
              key={side}
              position={[
                0,
                detail.height + 0.51,
                side === 0 ? detail.depth / 2 + 0.07 : -detail.depth / 2 - 0.07,
              ]}
              castShadow
            >
              <boxGeometry args={[detail.width + 0.28, 0.18, 0.12]} />
              <meshStandardMaterial color={detail.roof} roughness={0.86} />
            </mesh>
          ))}
          {[-1, 1].map((side) => (
            <mesh
              key={`side-${side}`}
              position={[
                side * (detail.width / 2 + 0.07),
                detail.height + 0.51,
                0,
              ]}
              castShadow
            >
              <boxGeometry args={[0.12, 0.18, detail.depth + 0.28]} />
              <meshStandardMaterial color={detail.roof} roughness={0.86} />
            </mesh>
          ))}
          <mesh position={[0, detail.height + 0.53, 0]} castShadow>
            <boxGeometry args={[0.42, 0.34, 0.42]} />
            <meshStandardMaterial color="#555B60" roughness={0.72} />
          </mesh>
          {["librarian", "builder", "planner"].includes(id) && (
            <FireEscape floors={floors} depth={detail.depth} />
          )}
          {(id === "librarian" || id === "builder") && (
            <WaterTower height={detail.height} />
          )}
      </>
      {id === "mayor" && (
        <group position={[0, detail.height + 0.93, 0]}>
          <mesh position={[0, 0.32, 0]} castShadow>
            <boxGeometry args={[0.58, 0.76, 0.58]} />
            <meshStandardMaterial color={detail.wall} roughness={0.88} />
          </mesh>
          <mesh position={[0, 0.34, 0.3]}>
            <circleGeometry args={[0.15, 20]} />
            <meshStandardMaterial color="#E8C96F" />
          </mesh>
          <mesh position={[0, 0.86, 0]} castShadow>
            <coneGeometry args={[0.42, 0.38, 4]} />
            <meshStandardMaterial color={detail.roof} roughness={0.8} />
          </mesh>
        </group>
      )}
      {id === "builder" && (
        <mesh position={[detail.width * 0.3, detail.height + 0.48, 0]} castShadow>
          <boxGeometry args={[0.34, 0.72, 0.34]} />
          <meshStandardMaterial color="#68564B" roughness={0.9} />
        </mesh>
      )}
    </group>
  );
}

function BuildingLot({ id }: { id: Exclude<AgentId, "mayor"> }) {
  const detail = buildings[id];
  const facing = Math.atan2(-detail.position[0], -detail.position[1]);

  return (
    <group
      position={[detail.position[0], 0, detail.position[1]]}
      rotation={[0, facing, 0]}
    >
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[3.8, 0.12, 3.4]} />
        <meshStandardMaterial color="#343D36" roughness={1} />
      </mesh>
      <mesh position={[0, 0.045, 2.05]} receiveShadow>
        <boxGeometry args={[0.72, 0.05, 1.05]} />
        <meshStandardMaterial color="#5F5B55" roughness={0.96} />
      </mesh>
      {[
        [-1.45, -1.15],
        [1.45, -1.15],
        [-1.45, 1.15],
        [1.45, 1.15],
      ].map(([x, z], index) => (
        <mesh key={index} position={[x, 0.18, z]} castShadow>
          <icosahedronGeometry args={[0.34, 1]} />
          <meshStandardMaterial
            color={index % 2 === 0 ? "#344A3B" : "#405743"}
            roughness={1}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}

function Tree({ position, phase }: { position: [number, number]; phase: number }) {
  const crown = useRef<Group>(null);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    elapsed.current += delta;
    if (crown.current) {
      crown.current.rotation.z = Math.sin(elapsed.current * 0.7 + phase) * 0.025;
    }
  });

  return (
    <group position={[position[0], 0, position[1]]}>
      <mesh position={[0, 0.58, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.16, 1.16, 8]} />
        <meshStandardMaterial color="#715D49" roughness={1} />
      </mesh>
      <group ref={crown} position={[0, 1.24, 0]}>
        <mesh position={[0, 0.42, 0]} castShadow>
          <sphereGeometry args={[0.72, 12, 10]} />
          <meshStandardMaterial color="#59765A" roughness={0.96} />
        </mesh>
        <mesh position={[-0.42, 0.12, 0.12]} castShadow>
          <sphereGeometry args={[0.48, 10, 8]} />
          <meshStandardMaterial color="#688261" roughness={0.96} />
        </mesh>
        <mesh position={[0.42, 0.13, -0.12]} castShadow>
          <sphereGeometry args={[0.5, 10, 8]} />
          <meshStandardMaterial color="#4F6E54" roughness={0.96} />
        </mesh>
      </group>
    </group>
  );
}

function StreetLight({ position }: { position: [number, number] }) {
  return (
    <group position={[position[0], 0, position[1]]}>
      <mesh position={[0, 1.05, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.07, 2.1, 8]} />
        <meshStandardMaterial color="#30353A" metalness={0.48} roughness={0.52} />
      </mesh>
      <mesh position={[0.18, 2.05, 0]} castShadow>
        <boxGeometry args={[0.42, 0.055, 0.055]} />
        <meshStandardMaterial color="#30353A" metalness={0.45} roughness={0.55} />
      </mesh>
      <mesh position={[0.38, 1.99, 0]} castShadow>
        <boxGeometry args={[0.2, 0.1, 0.16]} />
        <meshStandardMaterial
          color="#FFD58D"
          emissive="#FFC15E"
          emissiveIntensity={1.6}
          roughness={0.42}
        />
      </mesh>
      <pointLight
        position={[0.38, 1.92, 0]}
        color="#FFBD70"
        intensity={6}
        distance={7}
        decay={2}
      />
    </group>
  );
}

function TrafficCar({
  phase,
  color,
}: {
  phase: number;
  color: string;
}) {
  const car = useRef<Group>(null);
  const wheels = useRef<Mesh[]>([]);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    elapsed.current += delta;
    const angle = elapsed.current * 0.34 + phase;
    if (car.current) {
      car.current.position.set(Math.cos(angle) * 2.8, 0.045, Math.sin(angle) * 2.8);
      car.current.rotation.y = -angle;
    }
    for (const wheel of wheels.current) wheel.rotation.x += delta * 2.1;
  });

  return (
    <group ref={car}>
      <mesh position={[0, 0.26, 0]} castShadow>
        <boxGeometry args={[0.64, 0.3, 1.05]} />
        <meshStandardMaterial color={color} metalness={0.12} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.47, -0.04]} castShadow>
        <boxGeometry args={[0.48, 0.24, 0.52]} />
        <meshStandardMaterial color="#45515C" metalness={0.16} roughness={0.3} />
      </mesh>
      {[-0.2, 0.2].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.28, 0.54]}>
            <boxGeometry args={[0.12, 0.08, 0.04]} />
            <meshStandardMaterial color="#FFF1C7" emissive="#FFD06A" emissiveIntensity={1.8} />
          </mesh>
          <mesh position={[x, 0.28, -0.54]}>
            <boxGeometry args={[0.12, 0.08, 0.04]} />
            <meshStandardMaterial color="#A9463F" emissive="#8E332F" emissiveIntensity={0.12} />
          </mesh>
        </group>
      ))}
      {[-0.2, 0.2].map((x) => (
        <pointLight
          key={`headlight-${x}`}
          position={[x, 0.3, 0.62]}
          color="#FFE0A0"
          intensity={1.1}
          distance={3.2}
          decay={2}
        />
      ))}
      {[
        [-0.3, 0.14, -0.34],
        [0.3, 0.14, -0.34],
        [-0.3, 0.14, 0.34],
        [0.3, 0.14, 0.34],
      ].map((position, index) => (
        <mesh
          key={index}
          ref={(mesh) => {
            if (mesh) wheels.current[index] = mesh;
          }}
          position={position as [number, number, number]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.12, 0.12, 0.08, 12]} />
          <meshStandardMaterial color="#303635" roughness={0.88} />
        </mesh>
      ))}
    </group>
  );
}

function Roads() {
  const laneMarks = [-9, -7.8, -6.6, -5.4, -4.2, 4.2, 5.4, 6.6, 7.8, 9];

  return (
    <group>
      <mesh position={[0, -0.025, 0]} receiveShadow>
        <boxGeometry args={[22, 0.11, 1.45]} />
        <meshStandardMaterial color="#252A30" roughness={0.72} />
      </mesh>
      <mesh position={[0, -0.025, 0]} receiveShadow>
        <boxGeometry args={[1.45, 0.11, 18]} />
        <meshStandardMaterial color="#252A30" roughness={0.72} />
      </mesh>
      {[1, -1].map((side) => (
        <group key={side}>
          <mesh position={[0, -0.015, side * 0.91]} receiveShadow>
            <boxGeometry args={[22, 0.12, 0.36]} />
            <meshStandardMaterial color="#56585A" roughness={0.88} />
          </mesh>
          <mesh position={[side * 0.91, -0.015, 0]} receiveShadow>
            <boxGeometry args={[0.36, 0.12, 18]} />
            <meshStandardMaterial color="#56585A" roughness={0.88} />
          </mesh>
        </group>
      ))}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.035, 0]}
        receiveShadow
      >
        <ringGeometry args={[2.3, 3.35, 64]} />
        <meshStandardMaterial color="#252A30" roughness={0.72} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.04, 0]}
      >
        <ringGeometry args={[2.12, 2.26, 64]} />
        <meshStandardMaterial color="#56585A" roughness={0.88} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[3.37, 3.58, 64]} />
        <meshStandardMaterial color="#56585A" roughness={0.88} />
      </mesh>
      {laneMarks.map((mark) => (
        <group key={mark}>
          <mesh position={[mark, 0.04, 0]}>
            <boxGeometry args={[0.54, 0.018, 0.035]} />
            <meshBasicMaterial color="#E9E1C5" />
          </mesh>
          <mesh position={[0, 0.04, mark * 0.72]}>
            <boxGeometry args={[0.035, 0.018, 0.54]} />
            <meshBasicMaterial color="#E9E1C5" />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((direction) =>
        [0, 1, 2, 3, 4].map((stripe) => (
          <mesh
            key={`${direction}-${stripe}`}
            position={[direction * 3.82, 0.045, -0.52 + stripe * 0.26]}
          >
            <boxGeometry args={[0.19, 0.025, 0.16]} />
            <meshBasicMaterial color="#E9E1C5" />
          </mesh>
        )),
      )}
      {[-1, 1].map((direction) =>
        [0, 1, 2, 3, 4].map((stripe) => (
          <mesh
            key={`vertical-${direction}-${stripe}`}
            position={[-0.52 + stripe * 0.26, 0.045, direction * 3.82]}
          >
            <boxGeometry args={[0.16, 0.025, 0.19]} />
            <meshBasicMaterial color="#E9E1C5" />
          </mesh>
        )),
      )}
    </group>
  );
}

function TownScene({
  selectedAgent,
  onSelect,
}: {
  selectedAgent: AgentId;
  onSelect: (id: AgentId) => void;
}) {
  return (
    <div
      className="city-scene"
      role="group"
      aria-label="Interactive 3D city. Click a building to select its agent; drag to orbit and scroll to zoom."
    >
      <Canvas
        shadows="percentage"
        dpr={[1, 1.5]}
        camera={{ position: [12, 10, 15], fov: 42 }}
        fallback={<p className="city-scene-fallback">3D view is unavailable in this browser.</p>}
      >
        <color attach="background" args={["#26384D"]} />
        <fog attach="fog" args={["#26384D", 36, 90]} />
        <hemisphereLight args={["#9AAFD0", "#303633", 1.3]} />
        <directionalLight
          castShadow
          position={[7, 13, 8]}
          color="#B5C5E0"
          intensity={0.9}
          shadow-mapSize-width={1536}
          shadow-mapSize-height={1536}
        />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#3A463F" roughness={1} />
        </mesh>
        {agentIds
          .filter((id): id is Exclude<AgentId, "mayor"> => id !== "mayor")
          .map((id) => (
            <BuildingLot key={id} id={id} />
          ))}
        <Roads />
        <mesh position={[0, 0.035, 0]} receiveShadow>
          <cylinderGeometry args={[2.13, 2.13, 0.15, 64]} />
          <meshStandardMaterial color="#3D4A3F" roughness={0.96} />
        </mesh>
        <mesh position={[0, 0.115, 0]} receiveShadow>
          <cylinderGeometry args={[1.52, 1.52, 0.025, 48]} />
          <meshStandardMaterial color="#56585A" roughness={0.88} />
        </mesh>
        {treeLocations.map((position, index) => (
          <Tree key={index} position={position} phase={index * 0.61} />
        ))}
        {[
          [-7.3, 0],
          [7.3, 0],
          [0, -7.25],
          [0, 7.25],
        ].map((position, index) => (
          <StreetLight
            key={index}
            position={position as [number, number]}
          />
        ))}
        <TrafficCar phase={0} color="#A85B48" />
        <TrafficCar phase={Math.PI} color="#526D81" />
        {agentIds.map((id) => (
          <Building
            key={id}
            id={id}
            selected={selectedAgent === id}
            onSelect={onSelect}
          />
        ))}
        <OrbitControls
          makeDefault
          target={[0, 1.4, 0]}
          minDistance={10}
          maxDistance={25}
          maxPolarAngle={Math.PI / 2.05}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>
    </div>
  );
}

export default TownScene;
