import * as React from "react";
import Paper from "@mui/material/Paper";

const HANDLE_SELECTOR = "#draggable-dialog-title";
const CANCEL_SELECTOR = '[class*="MuiDialogContent-root"]';

export default function DraggablePaper(props) {
  const paperRef = React.useRef(null);
  const dragState = React.useRef(null);

  const handlePointerDown = React.useCallback((e) => {
    const handle = paperRef.current?.querySelector(HANDLE_SELECTOR);

    // Only initiate drag if the pointer is on the handle element
    if (!handle || !handle.contains(e.target)) return;

    // Cancel drag if the pointer is on an element matching the cancel selector
    if (e.target.closest(CANCEL_SELECTOR)) return;

    const rect = paperRef.current.getBoundingClientRect();
    const parentRect = paperRef.current.parentElement?.getBoundingClientRect();

    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: rect.left - (parentRect?.left ?? 0),
      offsetY: rect.top - (parentRect?.top ?? 0),
      parentWidth: parentRect?.width ?? window.innerWidth,
      parentHeight: parentRect?.height ?? window.innerHeight,
      elWidth: rect.width,
      elHeight: rect.height,
    };

    e.target.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = React.useCallback((e) => {
    if (!dragState.current || !paperRef.current) return;

    const { startX, startY, offsetX, offsetY, parentWidth, parentHeight, elWidth, elHeight } =
      dragState.current;

    let newX = offsetX + (e.clientX - startX);
    let newY = offsetY + (e.clientY - startY);

    // Clamp to parent bounds
    newX = Math.max(0, Math.min(newX, parentWidth - elWidth));
    newY = Math.max(0, Math.min(newY, parentHeight - elHeight));

    paperRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
    paperRef.current.style.margin = "0";
    paperRef.current.style.position = "absolute";
    paperRef.current.style.top = "0";
    paperRef.current.style.left = "0";
  }, []);

  const handlePointerUp = React.useCallback(() => {
    dragState.current = null;
  }, []);

  return (
    <Paper
      {...props}
      ref={paperRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}
