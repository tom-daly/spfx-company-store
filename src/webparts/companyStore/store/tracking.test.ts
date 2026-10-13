import { trackingFor, trackingHint, trackingLabel } from './tracking';

const linkOf = (tracking: string): string | undefined => {
  const t = trackingFor(tracking);
  return t && t.href;
};

describe('tracking', () => {
  it('has nothing to show when nothing was typed', () => {
    expect(trackingFor('')).toBeUndefined();
    expect(trackingFor('   ')).toBeUndefined();
  });

  it('keeps a web address as a link', () => {
    expect(trackingFor(' https://track.example.com/JD0146 ')).toEqual({
      text: 'https://track.example.com/JD0146', href: 'https://track.example.com/JD0146'
    });
    expect(linkOf('HTTP://track.example.com')).toBe('HTTP://track.example.com');
  });

  it('links a USPS number to the USPS tracking page', () => {
    expect(trackingFor('9400111298370084628366')).toEqual({
      text: '9400111298370084628366',
      href: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111298370084628366',
      carrier: 'USPS'
    });
  });

  it('recognises a number typed in groups, and shows it as typed', () => {
    const t = trackingFor('9400 1112 9837 0084 6283 66');
    expect(t && t.text).toBe('9400 1112 9837 0084 6283 66');
    expect(t && t.href).toBe('https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111298370084628366');
  });

  it('links a UPS number, whatever case it was typed in', () => {
    const t = trackingFor('1z999aa10123456784');
    expect(t && t.carrier).toBe('UPS');
    expect(t && t.href).toBe('https://www.ups.com/track?tracknum=1Z999AA10123456784');
  });

  it('links FedEx and OnTrac numbers to their own pages', () => {
    expect(trackingFor('986578788855')).toEqual({
      text: '986578788855', href: 'https://www.fedex.com/fedextrack/?trknbr=986578788855', carrier: 'FedEx'
    });
    expect(trackingFor('C11031500001879')).toEqual({
      text: 'C11031500001879', href: 'https://www.ontrac.com/tracking/?number=C11031500001879', carrier: 'OnTrac'
    });
  });

  it('makes a link of a web address pasted without its https://', () => {
    expect(trackingFor('www.fedex.com/fedextrack/?trknbr=986578788855')).toEqual({
      text: 'www.fedex.com/fedextrack/?trknbr=986578788855',
      href: 'https://www.fedex.com/fedextrack/?trknbr=986578788855'
    });
    expect(linkOf('ups.com/track?tracknum=1Z')).toBe('https://ups.com/track?tracknum=1Z');
  });

  it('leaves anything it does not recognise as plain text', () => {
    expect(trackingFor('JD014600006281')).toEqual({ text: 'JD014600006281' });
    expect(trackingFor('Sent with the courier')).toEqual({ text: 'Sent with the courier' });
    // eslint-disable-next-line no-script-url -- checking a harmful address is never made a link
    expect(trackingFor('javascript:alert(1)')).toEqual({ text: 'javascript:alert(1)' });
    expect(linkOf('https://')).toBeUndefined();
  });

  it('leaves international post and Amazon numbers as text, having no one page to link to', () => {
    expect(trackingFor('RB123456785GB')).toEqual({ text: 'RB123456785GB' });
    expect(trackingFor('TBA123456789012')).toEqual({ text: 'TBA123456789012' });
  });

  it('shows and links only the tracking number of a label scanned with its ZIP code in front', () => {
    const usps = (number: string): string => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${number}`;
    // ZIP code, then a tracking number starting 94.
    expect(trackingFor('420902109400111298370084628366')).toEqual({
      text: '9400111298370084628366', href: usps('9400111298370084628366'), carrier: 'USPS'
    });
    // ZIP+4.
    expect(linkOf('4201002334249200190132607600833457')).toBe(usps('9200190132607600833457'));
    // A tracking number that doesn't start 91 to 95.
    expect(linkOf('4202215371969010756003077385')).toBe(usps('71969010756003077385'));
    // Scanned, then typed out in groups.
    expect(linkOf('420 22153 9101026837331000039521')).toBe(usps('9101026837331000039521'));
    // FedEx SmartPost labels carry the ZIP code too.
    expect(linkOf('420 11213 92 6129098349792366623 8'))
      .toBe('https://www.fedex.com/fedextrack/?trknbr=9261290983497923666238');
  });

  it('sends DHL numbers to the page that covers every DHL service', () => {
    const t = trackingFor('3318810025');
    expect(t && t.carrier).toBe('DHL');
    expect(t && t.href).toBe('https://www.dhl.com/global-en/home/tracking.html?tracking-id=3318810025&submit=1');
  });

  it('names the carrier when it knows it', () => {
    expect(trackingLabel({ text: '1Z', carrier: 'UPS' })).toBe('UPS tracking');
    expect(trackingLabel({ text: 'JD0146' })).toBe('Tracking');
  });

  it('says what it took the number for, so a wrong guess can be put right', () => {
    expect(trackingHint('')).toBe('');
    expect(trackingHint('9400111298370084628366')).toBe(
      'Links to the USPS tracking page. Wrong carrier? Paste their tracking link instead.');
    expect(trackingHint('https://track.example.com/1')).toBe('Shows as a link.');
    expect(trackingHint('www.ups.com/track')).toBe('Shows as a link.');
    expect(trackingHint('JD014600006281')).toBe(
      "Not a number the store recognises, so it shows as text. Paste the carrier's tracking link to make it a link.");
  });

  it('gives the same answers after many different numbers have been typed', () => {
    for (let i = 0; i < 450; i++) trackingFor(`JD${i}0000000`);
    expect(linkOf('9400111298370084628366'))
      .toBe('https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111298370084628366');
    expect(trackingFor('JD014600006281')).toEqual({ text: 'JD014600006281' });
  });
});
