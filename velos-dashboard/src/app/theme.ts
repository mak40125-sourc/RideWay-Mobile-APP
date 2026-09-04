import { alpha, createTheme } from '@mui/material/styles'
import type {} from '@mui/x-data-grid/themeAugmentation'

declare module '@mui/material/styles' {
  interface Palette {
    surface: string
    elevated: string
  }
  interface PaletteOptions {
    surface?: string
    elevated?: string
  }
}

/**
 * Velos corner radius tiers (explicit pixel values only).
 *
 *  - control:  6px   (small controls: icons, list items, chips, badges)
 *  - input:    6px   (buttons, inputs, selects)
 *  - surface:  6px   (standard cards / stat panels)
 *  - panel:    4px   (workspace panels / tables / map frames)
 *  - large:    8px   (large surfaces)
 *  - floating: 12px  (dialogs, drawers, floating overlays)
 *
 * Velos is a structured, operations-first desktop workspace: surfaces stay
 * rectangular with restrained corners. Never use pill/oval/percentage rounding
 * on surfaces.
 */
export const velosRadii = {
  control: 6,
  input: 6,
  surface: 6,
  panel: 4,
  large: 8,
  floating: 12,
} as const

const brand = {
  main: '#3B5BDB',
  light: '#6E86EA',
  dark: '#2C46B4',
  contrastText: '#FFFFFF',
}

const baseTheme = createTheme()
const shadows = [...baseTheme.shadows] as typeof baseTheme.shadows
shadows[1] = '0 1px 2px rgba(18, 22, 40, 0.04), 0 1px 3px rgba(18, 22, 40, 0.05)'
shadows[2] = '0 1px 3px rgba(18, 22, 40, 0.05), 0 6px 16px rgba(18, 22, 40, 0.06)'
shadows[3] = '0 2px 6px rgba(18, 22, 40, 0.05), 0 10px 28px rgba(18, 22, 40, 0.08)'
shadows[4] = '0 3px 8px rgba(18, 22, 40, 0.06), 0 14px 40px rgba(18, 22, 40, 0.1)'
shadows[8] = '0 6px 16px rgba(18, 22, 40, 0.08), 0 16px 48px rgba(18, 22, 40, 0.12)'
shadows[16] = '0 12px 32px rgba(18, 22, 40, 0.1), 0 28px 64px rgba(18, 22, 40, 0.16)'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: brand,
    secondary: {
      main: '#55617A',
      light: '#6E7A93',
      dark: '#3F4A61',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F4F5F8',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1A1D27',
      secondary: '#5A6173',
      disabled: '#A6ACBA',
    },
    divider: '#E8EAF0',
    action: {
      hover: 'rgba(19, 22, 34, 0.045)',
      selected: 'rgba(59, 91, 219, 0.08)',
      focus: 'rgba(19, 22, 34, 0.12)',
    },
    success: {
      main: '#1E9E62',
      light: '#E5F5ED',
      dark: '#157A4B',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#D97A1F',
      light: '#FBF0E2',
      dark: '#A85C12',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#D34040',
      light: '#FCEBEB',
      dark: '#A92E2E',
      contrastText: '#FFFFFF',
    },
    info: {
      main: '#0F7FA6',
      light: '#E2F2F8',
      dark: '#0A5E7C',
      contrastText: '#FFFFFF',
    },
    surface: '#FFFFFF',
    elevated: 'rgba(255, 255, 255, 0.92)',
  },
  shape: {
    borderRadius: velosRadii.control,
  },
  shadows,
  typography: {
    fontFamily: [
      'GeneralSans',
      'system-ui',
      '-apple-system',
      'Segoe UI',
      'Roboto',
      'Helvetica Neue',
      'Arial',
      'sans-serif',
    ].join(','),
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    h4: {
      fontWeight: 600,
      letterSpacing: '-0.03em',
      lineHeight: 1.25,
    },
    h5: {
      fontWeight: 600,
      letterSpacing: '-0.025em',
      lineHeight: 1.3,
    },
    h6: {
      fontWeight: 600,
      letterSpacing: '-0.015em',
      lineHeight: 1.35,
    },
    subtitle1: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    subtitle2: {
      fontWeight: 600,
    },
    body1: {
      lineHeight: 1.55,
    },
    body2: {
      lineHeight: 1.5,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  transitions: {
    duration: {
      shortest: 120,
      shorter: 180,
      short: 220,
      standard: 280,
      complex: 340,
      enteringScreen: 240,
      leavingScreen: 200,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
      },
    },
    MuiAppBar: {
      defaultProps: {
        elevation: 0,
        color: 'inherit',
        position: 'sticky',
      },
      styleOverrides: {
        root: ({ theme: t }) => ({
          borderRadius: 0,
          backgroundColor: alpha(t.palette.background.paper, 0.8),
          backgroundImage: 'none',
          color: t.palette.text.primary,
          borderBottom: `1px solid ${t.palette.divider}`,
          backdropFilter: 'blur(18px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(18px) saturate(1.4)',
          transition: t.transitions.create(['background-color', 'box-shadow'], {
            duration: t.transitions.duration.short,
          }),
        }),
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: 56,
          '@media (min-width: 0px)': { minHeight: 52 },
          '@media (min-width: 600px)': { minHeight: 56 },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: ({ theme: t }) => ({
          backgroundColor: t.palette.background.paper,
          backgroundImage: 'none',
          borderRadius: 0,
          borderRight: `1px solid ${t.palette.divider}`,
        }),
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: ({ theme: t }) => ({
          borderRadius: velosRadii.panel,
          backgroundImage: 'none',
          transition: t.transitions.create(['box-shadow', 'background-color', 'border-color'], {
            duration: t.transitions.duration.short,
          }),
        }),
        outlined: ({ theme: t }) => ({
          borderColor: t.palette.divider,
        }),
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: velosRadii.surface,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: ({ theme: t }) => ({
          borderRadius: velosRadii.input,
          fontWeight: 500,
          textTransform: 'none',
          transition: t.transitions.create(['background-color', 'box-shadow', 'color'], {
            duration: t.transitions.duration.short,
          }),
        }),
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          borderRadius: velosRadii.control,
          transition: t.transitions.create(['background-color', 'color'], {
            duration: t.transitions.duration.short,
          }),
        }),
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          borderRadius: velosRadii.control,
          minHeight: 40,
          paddingInline: t.spacing(1.5),
          color: t.palette.text.secondary,
          transition: t.transitions.create(['background-color', 'color'], {
            duration: t.transitions.duration.short,
          }),
          '&:hover': {
            backgroundColor: alpha(t.palette.text.primary, 0.04),
            color: t.palette.text.primary,
          },
          '&.Mui-selected': {
            backgroundColor: alpha(t.palette.primary.main, 0.08),
            color: t.palette.primary.main,
            '& .MuiListItemIcon-root': {
              color: t.palette.primary.main,
            },
            '& .MuiListItemText-primary': {
              color: t.palette.primary.main,
              fontWeight: 600,
            },
            '&:hover': {
              backgroundColor: alpha(t.palette.primary.main, 0.12),
            },
          },
        }),
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          minWidth: 36,
          color: 'inherit',
          fontSize: 20,
          transition: t.transitions.create('color', { duration: t.transitions.duration.short }),
        }),
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          fontSize: '0.875rem',
          fontWeight: 500,
          letterSpacing: '-0.01em',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          borderRadius: velosRadii.control,
          fontWeight: 500,
          transition: t.transitions.create(['background-color', 'border-color', 'color'], {
            duration: t.transitions.duration.short,
          }),
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          borderColor: t.palette.divider,
          paddingBlock: t.spacing(1.4),
          paddingInline: t.spacing(2),
        }),
        head: ({ theme: t }) => ({
          color: t.palette.text.secondary,
          fontWeight: 500,
          fontSize: '0.75rem',
          letterSpacing: '0.02em',
          textTransform: 'none',
        }),
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          '&:hover': {
            backgroundColor: alpha(t.palette.text.primary, 0.035),
          },
        }),
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme: t }) => ({
          borderRadius: velosRadii.floating,
          backgroundImage: 'none',
          boxShadow: t.shadows[8],
        }),
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: ({ theme: t }) => ({
          borderRadius: velosRadii.floating,
          backgroundImage: 'none',
          boxShadow: t.shadows[8],
        }),
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: ({ theme: t }) => ({
          borderRadius: velosRadii.floating,
          backgroundImage: 'none',
          boxShadow: t.shadows[8],
        }),
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: ({ theme: t }) => ({
          borderRadius: 8,
          fontSize: '0.75rem',
          backgroundColor: t.palette.grey[900],
        }),
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          border: 'none',
          borderRadius: 0,
          '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': {
            outline: 'none',
          },
          '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
            outline: 'none',
          },
          '& .MuiDataGrid-row': {
            transition: t.transitions.create('background-color', {
              duration: t.transitions.duration.shorter,
            }),
          },
        }),
      },
    },
  },
})

export default theme
