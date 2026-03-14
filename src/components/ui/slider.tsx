"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

function Slider({
  className,
  defaultValue,
  value,
  onValueChange,
  min = 0,
  max = 10,
  step = 1,
  disabled,
  ...props
}: {
  className?: string
  defaultValue?: number
  value?: number
  onValueChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
} & Omit<SliderPrimitive.Root.Props, "value" | "defaultValue" | "onValueChange">) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        "relative flex w-full touch-none items-center select-none data-disabled:opacity-50",
        className
      )}
      value={value != null ? [value] : undefined}
      defaultValue={defaultValue != null ? [defaultValue] : undefined}
      onValueChange={(val: number[]) => onValueChange?.(val[0])}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex h-5 w-full items-center">
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
          <SliderPrimitive.Indicator className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="block size-4 shrink-0 rounded-full border border-primary/50 bg-background shadow-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-hidden disabled:pointer-events-none"
        />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
