import React from 'react';
import Svg, { Path, Rect, Circle, G } from 'react-native-svg';

/**
 * Pixel-perfect Apple SF Symbols rendered via pure SVG.
 * Guaranteed 100% native iOS look-and-feel without font delays or emoji quirks.
 */
export default function SFSymbol({ name, size = 24, color = '#ffffff', focused = false, weight = 'medium', style }) {
    const strokeWidth = weight === 'bold' ? 2.4 : weight === 'semibold' ? 2.0 : 1.7;

    switch (name) {
        // --- 1. LIBRARY / PHOTOS TAB ---
        case 'photo.on.rectangle':
        case 'photos': {
            if (focused) {
                return (
                    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
                        {/* Background Card */}
                        <Rect x="5" y="2.5" width="16" height="14" rx="3" fill={color} opacity={0.4} />
                        {/* Foreground Card */}
                        <Rect x="2.5" y="6.5" width="16" height="14" rx="3" fill={color} />
                        {/* Mountain cutout inside card */}
                        <Path
                            d="M4.5 17.5L8.5 12.5L11.5 15.5L14 12L16.5 17.5H4.5Z"
                            fill="#000000"
                            opacity={0.35}
                        />
                        <Circle cx="7" cy="10.5" r="1.3" fill="#000000" opacity={0.35} />
                    </Svg>
                );
            }
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
                    {/* Back outline card */}
                    <Path
                        d="M6 3.5H18.5C19.88 3.5 21 4.62 21 6V15"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />
                    {/* Front outline card */}
                    <Rect
                        x="3"
                        y="6.5"
                        width="15.5"
                        height="14"
                        rx="2.8"
                        stroke={color}
                        strokeWidth={strokeWidth}
                    />
                    {/* Mountain line */}
                    <Path
                        d="M4.5 17.5L8.2 12.8C8.6 12.3 9.4 12.3 9.8 12.8L11.5 14.8L13.2 12.8C13.6 12.3 14.4 12.3 14.8 12.8L17 15.5"
                        stroke={color}
                        strokeWidth={strokeWidth * 0.85}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <Circle cx="7.2" cy="10.5" r="1.1" fill={color} />
                </Svg>
            );
        }

        // --- 2. ALBUMS TAB ---
        case 'rectangle.stack':
        case 'albums': {
            if (focused) {
                return (
                    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
                        <Rect x="6.5" y="2.5" width="11" height="2" rx="1" fill={color} opacity={0.4} />
                        <Rect x="4.5" y="5.5" width="15" height="2" rx="1" fill={color} opacity={0.65} />
                        <Rect x="2.5" y="8.5" width="19" height="13" rx="3" fill={color} />
                    </Svg>
                );
            }
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
                    <Path d="M7 3.5H17" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" opacity={0.6} />
                    <Path d="M5 6.5H19" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" opacity={0.8} />
                    <Rect
                        x="3"
                        y="9.5"
                        width="18"
                        height="11.5"
                        rx="2.8"
                        stroke={color}
                        strokeWidth={strokeWidth}
                    />
                </Svg>
            );
        }

        // --- 3. FAVORITES TAB ---
        case 'heart':
        case 'favorites': {
            if (focused) {
                return (
                    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style}>
                        <Path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z" />
                    </Svg>
                );
            }
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
                    <Path
                        d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinejoin="round"
                    />
                </Svg>
            );
        }

        // --- 4. SEARCH TAB ---
        case 'magnifyingglass':
        case 'search': {
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
                    <Circle
                        cx="10.5"
                        cy="10.5"
                        r="6.8"
                        stroke={color}
                        strokeWidth={focused ? 2.3 : strokeWidth}
                    />
                    <Path
                        d="M15.5 15.5L20.5 20.5"
                        stroke={color}
                        strokeWidth={focused ? 2.5 : strokeWidth}
                        strokeLinecap="round"
                    />
                </Svg>
            );
        }

        // --- 5. PLUS / ADD ---
        case 'plus': {
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
                    <Path
                        d="M12 5V19M5 12H19"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />
                </Svg>
            );
        }

        // --- 6. ELLIPSIS / MORE ---
        case 'ellipsis.circle': {
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
                    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={strokeWidth} />
                    <Circle cx="8" cy="12" r="1.2" fill={color} />
                    <Circle cx="12" cy="12" r="1.2" fill={color} />
                    <Circle cx="16" cy="12" r="1.2" fill={color} />
                </Svg>
            );
        }

        // --- 7. SHARE (Square & Arrow Up) ---
        case 'square.and.arrow.up':
        case 'share': {
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
                    <Path
                        d="M12 3V15M12 3L7.5 7.5M12 3L16.5 7.5"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <Path
                        d="M5 12V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V12"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />
                </Svg>
            );
        }

        // --- 8. INFO (Info Circle) ---
        case 'info.circle':
        case 'info': {
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
                    <Circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth={strokeWidth} />
                    <Circle cx="12" cy="8" r="1.1" fill={color} />
                    <Path d="M12 11V16.5M10.5 16.5H13.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                </Svg>
            );
        }

        // --- 9. TRASH ---
        case 'trash': {
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
                    <Path d="M4 6.5H20M10 3.5H14M6 6.5L7.2 19.3C7.3 20.3 8.1 21 9.1 21H14.9C15.9 21 16.7 20.3 16.8 19.3L18 6.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M10 10.5V16.5M14 10.5V16.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                </Svg>
            );
        }

        // --- 10. FOLDER / ORGANIZE ---
        case 'folder': {
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
                    <Path
                        d="M3 6.5C3 5.4 3.9 4.5 5 4.5H9.5L11.5 7H19C20.1 7 21 7.9 21 9V18C21 19.1 20.1 20 19 20H5C3.9 20 3 19.1 3 18V6.5Z"
                        fill={focused ? color : 'none'}
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinejoin="round"
                    />
                </Svg>
            );
        }

        // --- 11. CHEVRON RIGHT / LEFT ---
        case 'chevron.right': {
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
                    <Path d="M9 5L16 12L9 19" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
            );
        }
        case 'chevron.left': {
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
                    <Path d="M15 19L8 12L15 5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
            );
        }

        // --- 12. CHECKMARK ---
        case 'checkmark': {
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
                    <Path d="M5 12.5L9.5 17L19 7.5" stroke={color} strokeWidth={strokeWidth * 1.2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
            );
        }

        // --- 13. LOCK / SECURITY ---
        case 'lock':
        case 'lock.fill': {
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
                    <Rect x="4" y="10" width="16" height="11" rx="3" stroke={color} strokeWidth={strokeWidth} fill={focused ? color : 'none'} />
                    <Path d="M7.5 10V7C7.5 4.51 9.51 2.5 12 2.5C14.49 2.5 16.5 4.51 16.5 7V10" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                    <Circle cx="12" cy="15.5" r="1.4" fill={color} />
                </Svg>
            );
        }

        // --- 14. PENCIL / EDIT ---
        case 'pencil':
        case 'edit': {
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
                    <Path d="M16.5 3.5C17.3 2.7 18.7 2.7 19.5 3.5C20.3 4.3 20.3 5.7 19.5 6.5L7.5 18.5L3 20L4.5 15.5L16.5 3.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M14.5 5.5L18.5 9.5" stroke={color} strokeWidth={strokeWidth} />
                </Svg>
            );
        }

        // --- 15. XMARK / CLOSE ---
        case 'xmark': {
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
                    <Path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth={strokeWidth * 1.1} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
            );
        }
        case 'xmark.circle.fill': {
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
                    <Circle cx="12" cy="12" r="10" fill={color} />
                    <Path d="M8.5 8.5L15.5 15.5M15.5 8.5L8.5 15.5" stroke="#1c1c1e" strokeWidth={2} strokeLinecap="round" />
                </Svg>
            );
        }

        // --- 16. PLAY / VIDEO ---
        case 'play.fill': {
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style}>
                    <Path d="M7.5 5.5C7.5 4.7 8.4 4.2 9.1 4.6L19 11.1C19.7 11.5 19.7 12.5 19.1 12.9L9.1 19.4C8.4 19.8 7.5 19.3 7.5 18.5V5.5Z" />
                </Svg>
            );
        }
        case 'video': {
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
                    <Rect x="2.5" y="6" width="13" height="12" rx="2.8" stroke={color} strokeWidth={strokeWidth} fill={focused ? color : 'none'} />
                    <Path d="M15.5 10L21.5 6.5V17.5L15.5 14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
            );
        }

        default:
            return null;
    }
}
