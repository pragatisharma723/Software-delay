import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { DomainName } from '../types/project.ts';

interface ProjectConstellation3DProps {
  activeDomain?: DomainName;
  accentHex?: string;
}

/**
 * 3D Project Management Timeline, Critical-Path Gantt Architecture & Milestone Control Board.
 * Styled in the Deep Midnight Navy (#07213B / #082441), Steel Cerulean Blue (#4C7DAE / #6495C6),
 * and Cool Ice Silver (#DCE5EE) palette.
 */
export function ProjectConstellation3D({
  accentHex = '#4C7DAE',
}: ProjectConstellation3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const accentRef = useRef(accentHex);
  accentRef.current = accentHex;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 560;
    const height = container.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07213B');
    scene.fog = new THREE.FogExp2('#07213B', 0.036);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(1.1, 4.9, 9.4);
    camera.lookAt(0, 0.15, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    // Lighting tailored for Midnight Navy & Ice Silver contrast
    const hemi = new THREE.HemisphereLight('#DCE5EE', '#07213B', 0.95);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#F6FAFF', 2.45);
    keyLight.position.set(5.5, 9.5, 6.5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#6495C6', 1.65);
    rimLight.position.set(-7.5, 4.5, -5.5);
    scene.add(rimLight);

    // Subtle architectural timeline floor grid
    const gridHelper = new THREE.GridHelper(18, 18, '#1B4268', '#0D2C4A');
    gridHelper.position.y = -1.35;
    scene.add(gridHelper);

    const boardGroup = new THREE.Group();
    scene.add(boardGroup);

    // Track geometries & materials for clean disposal
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      geometries.push(g);
      return g;
    };
    const regMat = <T extends THREE.Material>(m: T): T => {
      materials.push(m);
      return m;
    };

    // PBR Materials aligned strictly with the Midnight Navy / Steel Blue / Ice Silver theme
    const boardPlinthMat = regMat(
      new THREE.MeshStandardMaterial({
        color: '#0B2B4B',
        metalness: 0.65,
        roughness: 0.38,
      })
    );
    const trackRecessMat = regMat(
      new THREE.MeshStandardMaterial({
        color: '#061A2E',
        metalness: 0.3,
        roughness: 0.72,
      })
    );
    const brushedSilverMat = regMat(
      new THREE.MeshStandardMaterial({
        color: '#DCE5EE',
        metalness: 0.88,
        roughness: 0.16,
      })
    );
    const steelBlueMat = regMat(
      new THREE.MeshStandardMaterial({
        color: '#4C7DAE',
        metalness: 0.58,
        roughness: 0.24,
      })
    );
    const iceCeruleanMat = regMat(
      new THREE.MeshStandardMaterial({
        color: '#6495C6',
        metalness: 0.52,
        roughness: 0.2,
      })
    );
    const deepNavyBarMat = regMat(
      new THREE.MeshStandardMaterial({
        color: '#1B4268',
        metalness: 0.74,
        roughness: 0.26,
      })
    );
    const domainAccentMat = regMat(
      new THREE.MeshStandardMaterial({
        color: accentRef.current === '#082441' ? '#4C7DAE' : accentRef.current,
        metalness: 0.55,
        roughness: 0.22,
      })
    );
    const riskBufferMat = regMat(
      new THREE.MeshStandardMaterial({
        color: '#D48A45',
        metalness: 0.42,
        roughness: 0.3,
      })
    );
    const dependencyTubeMat = regMat(
      new THREE.MeshStandardMaterial({
        color: '#7FB0DE',
        metalness: 0.65,
        roughness: 0.22,
      })
    );
    const gateBeaconMat = regMat(
      new THREE.MeshStandardMaterial({
        color: '#6495C6',
        emissive: '#356594',
        emissiveIntensity: 0.45,
        metalness: 0.5,
        roughness: 0.2,
      })
    );

    // Helper: chamfered 2D rounded rectangle shape
    const makeRoundedRectShape = (w: number, h: number, r: number) => {
      const s = new THREE.Shape();
      const hw = w / 2;
      const hh = h / 2;
      s.moveTo(-hw + r, -hh);
      s.lineTo(hw - r, -hh);
      s.quadraticCurveTo(hw, -hh, hw, -hh + r);
      s.lineTo(hw, hh - r);
      s.quadraticCurveTo(hw, hh, hw - r, hh);
      s.lineTo(-hw + r, hh);
      s.quadraticCurveTo(-hw, hh, -hw, hh - r);
      s.lineTo(-hw, -hh + r);
      s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
      return s;
    };

    // 1. Grounded Project Management Schedule Board Plinth
    const plinthShape = makeRoundedRectShape(8.8, 4.9, 0.28);
    const plinthGeo = regGeo(
      new THREE.ExtrudeGeometry(plinthShape, {
        depth: 0.22,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 2,
      })
    );
    plinthGeo.rotateX(Math.PI / 2);
    const plinthMesh = new THREE.Mesh(plinthGeo, boardPlinthMat);
    plinthMesh.position.y = -0.18;
    plinthMesh.receiveShadow = true;
    boardGroup.add(plinthMesh);

    // Perimeter silver trim rails along front & back edges of schedule board
    const edgeRailGeo = regGeo(new THREE.BoxGeometry(8.55, 0.05, 0.06));
    const frontRail = new THREE.Mesh(edgeRailGeo, brushedSilverMat);
    frontRail.position.set(0, -0.15, 2.38);
    boardGroup.add(frontRail);
    const backRail = new THREE.Mesh(edgeRailGeo, brushedSilverMat);
    backRail.position.set(0, -0.15, -2.38);
    boardGroup.add(backRail);

    // 2. Five Sprint / Lifecycle Phase Divider Ribs along X
    const phaseRailGeo = regGeo(new THREE.BoxGeometry(0.035, 0.025, 4.45));
    const phaseTickGeo = regGeo(new THREE.CylinderGeometry(0.055, 0.055, 0.14, 12));
    const phaseXs = [-3.4, -1.7, 0, 1.7, 3.4];
    phaseXs.forEach((px) => {
      const rib = new THREE.Mesh(phaseRailGeo, deepNavyBarMat);
      rib.position.set(px, -0.155, 0);
      boardGroup.add(rib);

      const tick = new THREE.Mesh(phaseTickGeo, brushedSilverMat);
      tick.position.set(px, -0.1, 2.38);
      boardGroup.add(tick);
    });

    // 3. Five Composite Gantt Workstream Tracks + Task Bars + Milestones
    interface GanttSpec {
      z: number;
      startX: number;
      length: number;
      progressRatio: number;
      mat: THREE.Material;
      hasDelayBuffer?: boolean;
      milestoneHeight: number;
    }

    const ganttSpecs: GanttSpec[] = [
      // Track 1: Requirements & Scope Baseline
      { z: -1.58, startX: -3.55, length: 2.25, progressRatio: 1.0, mat: iceCeruleanMat, milestoneHeight: 0.72 },
      // Track 2: System Architecture & Modules
      { z: -0.79, startX: -2.05, length: 2.65, progressRatio: 0.92, mat: steelBlueMat, milestoneHeight: 0.85 },
      // Track 3: Critical-Path Core Engineering (Domain-accented)
      { z: 0.0, startX: -0.95, length: 3.35, progressRatio: 0.78, mat: domainAccentMat, milestoneHeight: 1.05 },
      // Track 4: QA Testing & Dependency Risk Buffer
      { z: 0.79, startX: 0.35, length: 2.65, progressRatio: 0.64, mat: steelBlueMat, hasDelayBuffer: true, milestoneHeight: 0.88 },
      // Track 5: Release Readiness & Delivery Gate
      { z: 1.58, startX: 1.45, length: 1.85, progressRatio: 0.55, mat: iceCeruleanMat, milestoneHeight: 0.78 },
    ];

    const trackChannelGeo = regGeo(new THREE.BoxGeometry(7.7, 0.045, 0.38));
    const capGeo = regGeo(new THREE.CylinderGeometry(0.16, 0.16, 0.28, 16));
    const milestoneGeo = regGeo(new THREE.OctahedronGeometry(0.18, 0));
    const stemGeo = regGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 8));

    const milestoneMeshes: Array<{ mesh: THREE.Mesh; baseY: number; phase: number }> = [];
    const barEndPoints: THREE.Vector3[] = [];
    const barStartPoints: THREE.Vector3[] = [];

    ganttSpecs.forEach((spec, idx) => {
      const workstreamGroup = new THREE.Group();
      workstreamGroup.position.set(0, 0, spec.z);

      // a) Recessed track groove across full timeline
      const channel = new THREE.Mesh(trackChannelGeo, trackRecessMat);
      channel.position.set(0, -0.145, 0);
      workstreamGroup.add(channel);

      // b) Bevelled Extruded Gantt Task Bar
      const barCenterX = spec.startX + spec.length / 2;
      const barShape = makeRoundedRectShape(spec.length, 0.32, 0.07);
      const barGeo = regGeo(
        new THREE.ExtrudeGeometry(barShape, {
          depth: 0.22,
          bevelEnabled: true,
          bevelThickness: 0.04,
          bevelSize: 0.035,
          bevelSegments: 2,
        })
      );
      barGeo.center();
      const taskMesh = new THREE.Mesh(barGeo, spec.mat);
      taskMesh.position.set(barCenterX, 0.06, 0);
      taskMesh.castShadow = true;
      taskMesh.receiveShadow = true;
      workstreamGroup.add(taskMesh);

      // c) Top completion progress slider bar
      const progLen = Math.max(0.35, spec.length * spec.progressRatio - 0.14);
      const progGeo = regGeo(new THREE.BoxGeometry(progLen, 0.06, 0.14));
      const progMesh = new THREE.Mesh(progGeo, brushedSilverMat);
      progMesh.position.set(spec.startX + 0.07 + progLen / 2, 0.24, 0);
      workstreamGroup.add(progMesh);

      // d) Silver start & finish anchor end-caps
      const startCap = new THREE.Mesh(capGeo, brushedSilverMat);
      startCap.position.set(spec.startX, 0.08, 0);
      workstreamGroup.add(startCap);

      const finishX = spec.startX + spec.length;
      const finishCap = new THREE.Mesh(capGeo, brushedSilverMat);
      finishCap.position.set(finishX, 0.08, 0);
      workstreamGroup.add(finishCap);

      // Optional Schedule Slip / Delay Buffer extension block on Track 4
      if (spec.hasDelayBuffer) {
        const bufferShape = makeRoundedRectShape(0.88, 0.28, 0.06);
        const bufferGeo = regGeo(
          new THREE.ExtrudeGeometry(bufferShape, {
            depth: 0.18,
            bevelEnabled: true,
            bevelThickness: 0.03,
            bevelSize: 0.03,
            bevelSegments: 2,
          })
        );
        bufferGeo.center();
        const bufferMesh = new THREE.Mesh(bufferGeo, riskBufferMat);
        bufferMesh.position.set(finishX + 0.48, 0.04, 0);
        bufferMesh.castShadow = true;
        workstreamGroup.add(bufferMesh);
      }

      // e) Vertical milestone pin + rotating diamond checkpoint
      const stem = new THREE.Mesh(stemGeo, deepNavyBarMat);
      stem.position.set(finishX, 0.45, 0);
      workstreamGroup.add(stem);

      const diamond = new THREE.Mesh(
        milestoneGeo,
        idx === 2 ? gateBeaconMat : brushedSilverMat
      );
      diamond.position.set(finishX, spec.milestoneHeight, 0);
      workstreamGroup.add(diamond);
      milestoneMeshes.push({ mesh: diamond, baseY: spec.milestoneHeight, phase: idx * 1.15 });

      boardGroup.add(workstreamGroup);

      barStartPoints.push(new THREE.Vector3(spec.startX, 0.18, spec.z));
      barEndPoints.push(new THREE.Vector3(finishX, 0.18, spec.z));
    });

    // 4. Planned Delivery Deadline Gate Arch (across X = 2.75)
    const gateX = 2.75;
    const gateGroup = new THREE.Group();
    gateGroup.position.set(gateX, 0, 0);

    const pillarGeo = regGeo(new THREE.CylinderGeometry(0.065, 0.085, 1.75, 16));
    const leftPillar = new THREE.Mesh(pillarGeo, brushedSilverMat);
    leftPillar.position.set(0, 0.72, -2.18);
    gateGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeo, brushedSilverMat);
    rightPillar.position.set(0, 0.72, 2.18);
    gateGroup.add(rightPillar);

    const crossbarGeo = regGeo(new THREE.BoxGeometry(0.14, 0.11, 4.52));
    const crossbar = new THREE.Mesh(crossbarGeo, gateBeaconMat);
    crossbar.position.set(0, 1.58, 0);
    gateGroup.add(crossbar);

    const baselineStripGeo = regGeo(new THREE.BoxGeometry(0.06, 0.03, 4.35));
    const baselineStrip = new THREE.Mesh(baselineStripGeo, gateBeaconMat);
    baselineStrip.position.set(0, -0.14, 0);
    gateGroup.add(baselineStrip);

    boardGroup.add(gateGroup);

    // 5. Critical-Path Dependency Conduits connecting predecessor ends to successor starts
    for (let i = 0; i < barEndPoints.length - 1; i++) {
      const from = barEndPoints[i];
      const to = barStartPoints[i + 1];
      const midA = new THREE.Vector3(from.x + 0.18, from.y + 0.36, from.z);
      const midB = new THREE.Vector3(to.x - 0.18, to.y + 0.36, to.z);
      const curve = new THREE.CatmullRomCurve3([from, midA, midB, to]);
      const tubeGeo = regGeo(new THREE.TubeGeometry(curve, 24, 0.028, 8, false));
      boardGroup.add(new THREE.Mesh(tubeGeo, dependencyTubeMat));
    }

    // 6. Elevated Progress Velocity Trajectory Spline over the Gantt Timeline
    const arcPoints = [
      new THREE.Vector3(-3.55, 1.15, -1.2),
      new THREE.Vector3(-1.75, 1.55, -0.45),
      new THREE.Vector3(0.05, 1.82, 0.15),
      new THREE.Vector3(1.65, 1.68, 0.75),
      new THREE.Vector3(3.15, 1.95, 1.25),
    ];
    const velocityCurve = new THREE.CatmullRomCurve3(arcPoints);
    const velocityTubeGeo = regGeo(new THREE.TubeGeometry(velocityCurve, 48, 0.032, 10, false));
    boardGroup.add(new THREE.Mesh(velocityTubeGeo, iceCeruleanMat));

    const nodeSphereGeo = regGeo(new THREE.SphereGeometry(0.085, 16, 16));
    arcPoints.forEach((pt) => {
      const node = new THREE.Mesh(nodeSphereGeo, brushedSilverMat);
      node.position.copy(pt);
      boardGroup.add(node);
    });

    // Pointer parallax & resize handling
    const pointerTarget = { x: 0, y: 0 };
    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      const ny = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
      pointerTarget.x = nx * 0.24;
      pointerTarget.y = ny * 0.11;
    };
    container.addEventListener('pointermove', onPointerMove);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 560;
      const h = container.clientHeight || 400;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      const nextHex = accentRef.current === '#082441' ? '#4C7DAE' : accentRef.current;
      domainAccentMat.color.set(nextHex);

      // Smooth architectural 3/4 inspection oscillation + pointer tilt
      const targetRotY = -0.22 + Math.sin(elapsed * 0.28) * 0.2 + pointerTarget.x;
      const targetRotX = 0.08 + pointerTarget.y;

      boardGroup.rotation.y = THREE.MathUtils.damp(boardGroup.rotation.y, targetRotY, 3.5, dt);
      boardGroup.rotation.x = THREE.MathUtils.damp(boardGroup.rotation.x, targetRotX, 3.5, dt);

      milestoneMeshes.forEach((item) => {
        item.mesh.rotation.y += dt * 0.9;
        item.mesh.position.y = item.baseY + Math.sin(elapsed * 1.6 + item.phase) * 0.06;
      });

      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      container.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="w-full h-full min-h-[380px] rounded-xl overflow-hidden bg-[#07213B]"
      aria-label="Interactive 3D project management Gantt timeline and milestone architecture"
    />
  );
}
