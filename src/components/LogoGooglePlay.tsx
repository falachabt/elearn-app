import Svg, { Path } from 'react-native-svg';

/** Logo Google Play : triangle « play » en quatre couleurs de la marque (bleu, vert, jaune, rouge). */
export function LogoGooglePlay({ taille = 20 }: { taille?: number }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24" accessible={false}>
      <Path fill="#00D7FE" d="M3.6 1.8 13.6 12 3.6 22.2C3.3 22 3 21.5 3 21V3c0-.5.3-1 .6-1.2z" />
      <Path fill="#00F076" d="M13.6 12 16.9 8.7 4.6 1.7c-.4-.2-.8-.2-1 .1z" />
      <Path fill="#FF3A44" d="M13.6 12 16.9 15.3 4.6 22.3c-.4.2-.8.2-1-.1z" />
      <Path fill="#FFCE00" d="M16.9 8.7 21 11c.8.5.8 1.5 0 2l-4.1 2.3L13.6 12z" />
    </Svg>
  );
}
