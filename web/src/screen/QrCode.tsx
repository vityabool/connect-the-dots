import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/** A QR code (as inline SVG) that opens `value`. White background so phones can scan it from a projector. */
export function QrCode(props: { value: string; label: string; size?: number }) {
  const [svg, setSvg] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(props.value, { type: 'svg', margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
      .then((markup) => {
        if (!cancelled) setSvg(markup);
      })
      .catch(() => {
        if (!cancelled) setSvg(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [props.value]);

  if (!svg) return null;
  return (
    <div
      className="qr"
      role="img"
      aria-label={props.label}
      style={props.size ? { width: props.size, height: props.size } : undefined}
      // The markup is generated locally by the qrcode library from the join link.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
