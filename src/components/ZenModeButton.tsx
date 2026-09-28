import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2 } from 'lucide-react';
import ZenModeOverlay from './ZenModeOverlay';

interface ZenModeButtonProps {
  targetRef: React.RefObject<HTMLElement>;
  markdown: string;
}

const ZenModeButton = ({ targetRef, markdown }: ZenModeButtonProps) => {
  const [isZenMode, setIsZenMode] = useState(false);

  const enterZenMode = useCallback(() => {
    // We use a fixed overlay instead of native fullscreen to avoid rotation issues
    setIsZenMode(true);
    // Also try native fullscreen for the immersive experience
    if (targetRef.current) {
      const element = targetRef.current;
      const requestFullscreen = element.requestFullscreen || 
        (element as any).webkitRequestFullscreen ||
        (element as any).msRequestFullscreen;
      if (requestFullscreen) {
        requestFullscreen.call(element).catch(() => {
          // Fullscreen not supported in this context, overlay still works
        });
      }
    }
  }, [targetRef]);

  const exitZenMode = useCallback(() => {
    if (document.fullscreenElement) {
      const exitFullscreen = document.exitFullscreen ||
        (document as any).webkitExitFullscreen ||
        (document as any).msExitFullscreen;
      if (exitFullscreen) {
        exitFullscreen.call(document).catch(() => {});
      }
    }
    setIsZenMode(false);
  }, []);

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isZenMode) {
        // Don't auto-exit zen mode when fullscreen exits due to rotation
        // The overlay stays visible regardless
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isZenMode]);

  return (
    <>
      {/* Zen Mode Overlay - Full reading experience */}
      <ZenModeOverlay isActive={isZenMode} onExit={exitZenMode} markdown={markdown} />

      {/* Enter Zen Mode Button */}
      <AnimatePresence>
        {!isZenMode && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={enterZenMode}
            className="absolute bottom-24 md:bottom-4 right-4 z-50 p-3 rounded-full bg-emerald-500 text-white shadow-lg hover:bg-emerald-600 transition-colors"
            title="Zen Mode - Distraction-free reading"
          >
            <Maximize2 className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
};

export default ZenModeButton;
