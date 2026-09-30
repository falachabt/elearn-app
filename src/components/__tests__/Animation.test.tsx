import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { Animation } from '../Animation';

jest.mock('lottie-react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return { __esModule: true, default: (props: object) => <View testID="lottie" {...props} /> };
});

const source = { v: '5.0', fr: 30, ip: 0, op: 30, w: 10, h: 10, layers: [], assets: [] };
const lottie = (r: ReturnType<typeof render> extends Promise<infer T> ? T : never) => r.getByTestId('lottie');

describe('Animation', () => {
  afterEach(() => jest.restoreAllMocks());

  it('joue automatiquement par défaut', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const r = await render(<Animation source={source} boucle />);
    await act(async () => {});
    expect(lottie(r).props).toMatchObject({ autoPlay: true, loop: true });
  });

  it('affiche une image fixe quand les animations sont réduites', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const r = await render(<Animation source={source} boucle imageFixe={0.5} />);
    await act(async () => {});
    expect(lottie(r).props).toMatchObject({ autoPlay: false, loop: false, progress: 0.5 });
  });
});
