import type { ComponentChildren } from "preact";
import { motion, AnimatePresence } from 'framer-motion';

export default function PageTransition({
  children,
  path,
}: {
  children: ComponentChildren;
  path: string;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={path}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.32 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
