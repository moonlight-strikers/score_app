import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Standardized Capsule Button Component for MoonLight Strikers
 *
 * Implements the capsule button design reference:
 * - Variants:
 *   - 'primary': Filled blue background, white text, white monochrome icon
 *   - 'secondary' | 'outline': Surface background, thin blue border, theme text & monochrome icon
 *   - 'elevated' | 'soft': Light surface, soft shadow, theme text & monochrome icon
 *   - 'destructive' | 'danger': Red background, white text, white monochrome icon
 *   - 'ghost': Transparent background
 * - Heights:
 *   - 'md' (default): 44px
 *   - 'sm': 36px
 *   - 'lg': 48px
 *   - 'icon': 44x44px round icon-only touch target
 * - Typography: 14-15px font-semibold (600)
 * - Shape: Rounded capsule (rounded-full)
 * - Icons: Strict monochrome (white on filled/dark, dark on light)
 */
const Button = forwardRef(function Button(
  {
    children,
    type = 'button',
    variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'elevated' | 'soft' | 'destructive' | 'danger' | 'ghost'
    size = 'md', // 'sm' | 'md' | 'lg' | 'icon'
    icon: Icon = null,
    iconPosition = 'left', // 'left' | 'right'
    loading = false,
    loadingText = '',
    disabled = false,
    fullWidth = false,
    className = '',
    onClick,
    ...props
  },
  ref
) {
  // Normalize variant aliases
  const normalizedVariant =
    variant === 'outline' ? 'outline' :
    variant === 'soft' ? 'soft' :
    variant === 'secondary' ? 'secondary' :
    variant === 'elevated' ? 'elevated' :
    variant === 'destructive' || variant === 'danger' ? 'danger' :
    variant === 'ghost' ? 'ghost' :
    'primary';

  // Base variant class mapping
  const variantClassMap = {
    primary: 'ms-btn-primary',
    secondary: 'ms-btn-secondary',
    outline: 'ms-btn-outline',
    elevated: 'ms-btn-elevated',
    soft: 'ms-btn-soft',
    danger: 'ms-btn-danger',
    ghost: 'ms-btn-ghost'
  };

  // Size class mapping
  const sizeClassMap = {
    sm: 'ms-btn-sm',
    md: '',
    lg: 'ms-btn-lg',
    icon: 'ms-btn-icon'
  };

  const variantClass = variantClassMap[normalizedVariant] || 'ms-btn-primary';
  const sizeClass = sizeClassMap[size] || '';
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`ms-btn ${variantClass} ${sizeClass} ${widthClass} ${className}`.trim()}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" />
          <span>{loadingText || children}</span>
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon />}
          {children && <span>{children}</span>}
          {Icon && iconPosition === 'right' && <Icon />}
        </>
      )}
    </button>
  );
});

export default Button;
