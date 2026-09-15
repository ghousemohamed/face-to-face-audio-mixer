export function DeviceMeter({ device }) {
  const score = device.level ?? Math.max(0, Math.min(1, device.score));

  return (
    <li className="meter" data-selected={device.selected || undefined}>
      <div className="meter__head">
        <span className="meter__name" title={device.id}>
          {device.participantName ?? device.id}
        </span>
        {device.selected && <span className="meter__badge">Selected</span>}
        {device.mixed && <span className="meter__badge">Mixed</span>}
        {device.starved && (
          <span className="meter__badge meter__badge--warn" title="No audio arrived in time">
            Starved
          </span>
        )}
      </div>

      <div className="meter__bar" style={{ '--score': score }}>
        <span />
      </div>

      <dl className="meter__stats">
        <div>
          <dt>score</dt>
          <dd>{device.score?.toFixed(2) ?? 'off'}</dd>
        </div>
        <div>
          <dt>vad</dt>
          <dd>{device.voiceProbability?.toFixed(2) ?? 'off'}</dd>
        </div>
        <div>
          <dt>snr</dt>
          <dd>{device.snrDb == null ? 'off' : `${Math.round(device.snrDb)} dB`}</dd>
        </div>
        <div>
          <dt>level</dt>
          <dd>{Math.round(device.rmsDb)} dB</dd>
        </div>
        <div>
          <dt>floor</dt>
          <dd>{device.noiseFloorDb == null ? 'off' : `${Math.round(device.noiseFloorDb)} dB`}</dd>
        </div>
      </dl>
    </li>
  );
}
