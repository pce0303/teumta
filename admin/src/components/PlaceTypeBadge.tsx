import { PLACE_TYPE_LABELS, type PlaceType } from '../types/place';

export function PlaceTypeBadge({ type }: { type: PlaceType }) {
  return (
    <span
      className={`badge ${type === 'TOURIST_SPOT' ? 'badge-tourist' : 'badge-local'}`}
    >
      {PLACE_TYPE_LABELS[type]}
    </span>
  );
}
