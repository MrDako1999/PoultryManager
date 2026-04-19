import Svg, { Path, G, Defs, Use } from 'react-native-svg';

/**
 * United States flag — Stars and Stripes (DDD-F-416E specifications).
 * Renders crisp at any size; uses react-native-svg's <Use> for the star
 * pattern so the bundle stays tiny.
 */
export default function UnitedStatesFlag({ size = 20, rounded = false, style }) {
  // Aspect ratio 7410:3900 -> ~1.9 : 1.
  const width = size * 1.9;
  const height = size;

  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 7410 3900"
      style={style}
      // Round the SVG itself rather than wrapping in a clipped View — RN-SVG
      // honours `borderRadius` on the root via the underlying CALayer.
      {...(rounded ? { borderRadius: size * 0.18 } : {})}
    >
      {/* Red field */}
      <Path d="M0,0h7410v3900H0" fill="#bf0a30" />
      {/* White stripes (drawn as a single thick stroke path) */}
      <Path
        d="M0,450H7410m0,600H0m0,600H7410m0,600H0m0,600H7410m0,600H0"
        stroke="#FFF"
        strokeWidth={300}
      />
      {/* Blue canton */}
      <Path d="M0,0h2964v2100H0" fill="#00205b" />
      {/* 50 stars */}
      <G fill="#FFF">
        <Defs>
          <Path
            id="star"
            d="M247,90 317.534230,307.082039 132.873218,172.917961H361.126782L176.465770,307.082039z"
          />
          <G id="s4">
            <Use href="#star" />
            <Use href="#star" y={420} />
            <Use href="#star" y={840} />
            <Use href="#star" y={1260} />
          </G>
          <G id="s5">
            <Use href="#s4" />
            <Use href="#star" y={1680} />
          </G>
          <G id="s9">
            <Use href="#s5" />
            <Use href="#s4" x={247} y={210} />
          </G>
          <G id="s18">
            <Use href="#s9" />
            <Use href="#s9" x={494} />
          </G>
        </Defs>
        <Use href="#s18" />
        <Use href="#s18" x={988} />
        <Use href="#s9" x={1976} />
        <Use href="#s5" x={2470} />
      </G>
    </Svg>
  );
}
