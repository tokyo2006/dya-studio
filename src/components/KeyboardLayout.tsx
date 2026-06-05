/**
 * KeyboardLayout Component
 *
 * Renders the physical keyboard layout based on KeyPhysicalAttrs.
 * Handles key selection, modification display, and interaction.
 * Responsive to window size with min/max limits.
 */
import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { PhysicalKey } from "./PhysicalKey";
import { PhysicalLayoutModule } from "./PhysicalLayoutModule";
import type {
  PhysicalLayout,
  KeyPhysicalAttrs,
  Layer,
  BehaviorBinding,
  BehaviorDefinition,
} from "../hooks/useKeymap";
import type { PhysicalLayoutModulePresentation } from "../hooks/usePhysicalLayoutModules";
import { formatBehaviorBinding } from "../lib/behaviorMetadata";
import type { KeyboardLayoutType } from "../lib/keyboardLayouts";

// Base unit size for 1U key in pixels at scale 1.0
const BASE_UNIT_SIZE = 54;
// Min and max scale limits for responsive sizing
const MIN_SCALE = 0.8;
const MAX_SCALE = 1.2;

interface KeyboardLayoutProps {
  /** Physical layout configuration */
  layout: PhysicalLayout;
  /** Current layer to display */
  layer: Layer;
  /** Array of all available layers */
  layers: Layer[];
  /** Map of behavior definitions */
  behaviors: Map<number, BehaviorDefinition>;
  /** Map of original bindings (unused but kept for potential future use) */
  // originalBindings: Map<string, BehaviorBinding>;
  /** Currently selected key position (or null) */
  selectedKey: number | null;
  /** Callback when a key is clicked */
  onKeyClick: (keyPosition: number) => void;
  /** Callback to reset a key to original */
  onKeyReset: (keyPosition: number) => void;
  /** Function to check if a binding is modified */
  isBindingModified: (layerId: number, keyPosition: number) => boolean;
  /** Function to get original binding */
  getOriginalBinding: (
    layerId: number,
    keyPosition: number,
  ) => BehaviorBinding | null;
  /** Keyboard layout for keycode display */
  keyboardLayout?: KeyboardLayoutType;
  /** Optional non-key physical modules from custom physical layout RPC */
  modules?: PhysicalLayoutModulePresentation[];
  /** Key positions currently highlighted in the preview */
  highlightedKeys?: ReadonlySet<number>;
}

type LayoutGeometry = Pick<
  KeyPhysicalAttrs,
  "width" | "height" | "x" | "y" | "r" | "rx" | "ry"
>;

function rotationDegrees(centidegrees: number) {
  return centidegrees / 100;
}

function rotatedCorners(geometry: LayoutGeometry) {
  const corners = [
    { x: geometry.x, y: geometry.y },
    { x: geometry.x + geometry.width, y: geometry.y },
    { x: geometry.x + geometry.width, y: geometry.y + geometry.height },
    { x: geometry.x, y: geometry.y + geometry.height },
  ];

  if (!geometry.r) {
    return corners;
  }

  const radians = rotationDegrees(geometry.r) * (Math.PI / 180);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return corners.map((corner) => {
    const dx = corner.x - geometry.rx;
    const dy = corner.y - geometry.ry;
    return {
      x: geometry.rx + dx * cos - dy * sin,
      y: geometry.ry + dx * sin + dy * cos,
    };
  });
}

export function KeyboardLayout({
  layout,
  layer,
  layers,
  behaviors,
  selectedKey,
  onKeyClick,
  onKeyReset,
  isBindingModified,
  getOriginalBinding,
  keyboardLayout,
  modules = [],
  highlightedKeys,
}: KeyboardLayoutProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1.0);

  // Calculate raw layout bounds (at scale 1.0)
  const rawBounds = useMemo(() => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    const geometries: LayoutGeometry[] = [
      ...layout.keys,
      ...modules.map((module) => module.attrs),
    ];

    if (geometries.length === 0) {
      return {
        width: 200,
        height: 160,
        offsetX: 10,
        offsetY: 30,
      };
    }

    geometries.flatMap(rotatedCorners).forEach((point) => {
      const x = (point.x / 100) * BASE_UNIT_SIZE;
      const y = (point.y / 100) * BASE_UNIT_SIZE;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });

    return {
      width: maxX - minX + 20,
      height: maxY - minY + 60,
      offsetX: -minX + 10,
      offsetY: -minY + 30,
    };
  }, [layout.keys, modules]);

  // Calculate responsive scale based on container width
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.clientWidth;
      // Calculate scale to fit the layout in the container with some padding
      const targetWidth = containerWidth - 32; // 16px padding on each side
      const naturalScale = targetWidth / rawBounds.width;

      // Clamp scale between min and max
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, naturalScale));
      setScale(newScale);
    };

    updateScale();

    // Create ResizeObserver for responsive updates (with fallback for older browsers)
    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(updateScale);
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }
      return () => resizeObserver.disconnect();
    } else {
      // Fallback: use window resize event
      window.addEventListener("resize", updateScale);
      return () => window.removeEventListener("resize", updateScale);
    }
  }, [rawBounds.width]);

  // Calculate scaled bounds
  const bounds = useMemo(
    () => ({
      width: rawBounds.width * scale,
      height: rawBounds.height * scale,
      offsetX: rawBounds.offsetX * scale,
      offsetY: rawBounds.offsetY * scale,
    }),
    [rawBounds, scale],
  );

  // Get display name for a key at position
  const getKeyDisplayName = useCallback(
    (_keyPosition: number, binding: BehaviorBinding | undefined): string => {
      if (!binding) return "—";
      const behavior = behaviors.get(binding.behaviorId) || null;
      return formatBehaviorBinding(binding, behavior, {
        shortFormat: true,
        layers: layers,
        keyboardLayout,
      });
    },
    [behaviors, layers, keyboardLayout],
  );

  const getKeyLongDisplayName = useCallback(
    (_keyPosition: number, binding: BehaviorBinding | undefined): string => {
      if (!binding) return "—";
      const behavior = behaviors.get(binding.behaviorId) || null;
      return formatBehaviorBinding(binding, behavior, {
        layers: layers,
        keyboardLayout,
      });
    },
    [behaviors, layers, keyboardLayout],
  );

  // Get original display name for tooltip
  const getOriginalDisplayName = useCallback(
    (keyPosition: number): string | undefined => {
      const original = getOriginalBinding(layer.id, keyPosition);
      if (!original) return undefined;
      const behavior = behaviors.get(original.behaviorId) || null;
      return formatBehaviorBinding(original, behavior, {
        layers: layers,
        keyboardLayout,
      });
    },
    [getOriginalBinding, layer, behaviors, layers, keyboardLayout],
  );

  // Get full binding description for tooltip
  const getBindingDescription = useCallback(
    (binding: BehaviorBinding | undefined): string => {
      if (!binding) return t("keycodes.noBinding");
      const behavior = behaviors.get(binding.behaviorId) || null;
      const behaviorName =
        behavior?.displayName ||
        `${t("keycodes.behavior")} ${binding.behaviorId}`;
      return `${behaviorName} (${t("keycodes.param1")}: ${binding.param1}, ${t("keycodes.param2")}: ${binding.param2})`;
    },
    [behaviors, t],
  );

  return (
    <div ref={containerRef} className="relative overflow-auto w-full">
      <div
        className="relative mx-auto"
        style={{
          width: `${bounds.width}px`,
          height: `${bounds.height}px`,
        }}
      >
        {layout.keys.map((key, position) => {
          const binding = layer.bindings[position];
          const modified = isBindingModified(layer.id, position);

          // Adjust position with offset for centering
          const adjustedKey: KeyPhysicalAttrs = {
            ...key,
            x: key.x + (rawBounds.offsetX / BASE_UNIT_SIZE) * 100,
            y: key.y + (rawBounds.offsetY / BASE_UNIT_SIZE) * 100,
          };

          return (
            <PhysicalKey
              key={position}
              attrs={adjustedKey}
              keyPosition={position}
              binding={binding}
              isModified={modified}
              displayName={getKeyDisplayName(position, binding)}
              longDisplayName={getKeyLongDisplayName(position, binding)}
              originalDisplayName={
                modified ? getOriginalDisplayName(position) : undefined
              }
              bindingDescription={getBindingDescription(binding)}
              isSelected={selectedKey === position}
              isHighlighted={highlightedKeys?.has(position)}
              onClick={() => onKeyClick(position)}
              onReset={() => onKeyReset(position)}
              scale={scale}
            />
          );
        })}
        {modules.map((module) => {
          const adjustedModule: PhysicalLayoutModulePresentation = {
            ...module,
            attrs: {
              ...module.attrs,
              x: module.attrs.x + (rawBounds.offsetX / BASE_UNIT_SIZE) * 100,
              y: module.attrs.y + (rawBounds.offsetY / BASE_UNIT_SIZE) * 100,
              rx: module.attrs.rx + (rawBounds.offsetX / BASE_UNIT_SIZE) * 100,
              ry: module.attrs.ry + (rawBounds.offsetY / BASE_UNIT_SIZE) * 100,
            },
          };

          return (
            <PhysicalLayoutModule
              key={module.identifier}
              module={adjustedModule}
              scale={scale}
            />
          );
        })}
      </div>
    </div>
  );
}
