# Flow Motion Components
### Velos Component Design System
Version: 1.0

---

# Introduction

This document defines every reusable component used throughout Velos.

These specifications are mandatory.

Components should never be redesigned on individual screens.

Every screen must reuse these standards.

Consistency is more important than creativity.

---

# Global Design Tokens

## Font

General Sans

Never mix fonts.

---

## Corner Radius

Small
12dp

Medium
16dp

Large
24dp

Bottom Sheet
32dp

Never exceed 32dp.

---

## Shadows

Flow Motion uses extremely soft shadows.

Never use harsh Material elevation.

Cards should appear to float naturally.

Shadow Opacity

8–12%

Shadow Blur

18–28

Shadow Offset

0
8

Android

Elevation
4–6

---

# Spacing System

Micro
4dp

Small
8dp

Medium
16dp

Large
24dp

XL
32dp

XXL
48dp

Whitespace is intentional.

Never reduce spacing to fit more content.

---

# Typography Scale

Display

40sp

Bold

---

Heading

28sp

SemiBold

---

Section

18sp

SemiBold

---

Body

16sp

Regular

---

Caption

14sp

Medium

---

Label

12sp

Medium

---

# Floating Menu Button

Purpose

Primary navigation entry.

Always floating.

Never attached to headers.

## Position

Top

Safe Area +16dp

Left

16dp

## Size

48 × 48dp

Perfect square.

## Radius

16dp

## Background

White

## Icon

Hamburger

20dp

#111111

Three horizontal lines

Centered

## Pressed State

Scale

1.00

↓

0.96

90ms

Spring Back

180ms

No ripple.

No opacity flash.

---

# Notification Button

Identical size to menu button.

48dp

Placed top-right.

16dp margin.

Visual weight equal to menu button.

---

# Bottom Sheet

Purpose

Primary interaction surface.

## Initial Height

28–34%

Screen height

Never exceed this until expanded.

## Radius

32dp

## Background

White

## Handle

Width

44dp

Height

5dp

Radius

999dp

Top Margin

12dp

Bottom Margin

20dp

---

# Search Field

Height

54dp

Radius

20dp

Horizontal Padding

18dp

Background

#F5F5F5

Placeholder

General Sans

16sp

Search icon

20dp

Shadow

Very subtle

---

# Interactive Rows

Examples

Current Location

Saved Place

Ride History

Settings

Minimum Height

56dp

Radius

16dp

Padding

18dp

Pressed State

Scale

0.98

90ms

Return

Spring

Rows should feel touchable.

Never resemble plain text.

---

# Status Card

Examples

Waiting for Ride Requests

Searching Driver

Driver Assigned

Radius

24dp

Padding

20dp

Background

White

Soft Shadow

Green Status Dot

10dp

Typography

16sp

Medium

---

# Wallet / Earnings Card

Background

#111111

Radius

24dp

Minimum Height

88dp

Padding

24dp

Two Equal Columns

Centered Divider

Typography

Label

14sp

Medium

Amount

30sp

Bold

Columns must always remain visually balanced.

---

# Cards

Radius

24dp

Padding

20dp

Spacing Between Cards

16dp

Never stack cards tightly.

Cards should breathe.

---

# Profile Header

Avatar

72dp

Circular

User Name

24sp

SemiBold

Phone Number

16sp

Regular

Edit Profile

Outlined Button

Never use oversized profile headers.

---

# List Item

Height

60dp

Padding

20dp

Icon

22dp

Title

16sp

Medium

Chevron

18dp

Spacing should be symmetrical.

---

# Primary Button

Height

54dp

Radius

18dp

Font

16sp

SemiBold

Horizontal Padding

24dp

Pressed

Scale

0.97

---

# Secondary Button

Outlined

54dp

Radius

18dp

No heavy borders.

---

# Floating Action Components

Always float.

Never attach to screen edges.

Minimum Margin

16dp

Soft shadows only.

---

# Icons

Primary

22dp

Secondary

20dp

Small

18dp

Use one consistent icon family.

Never mix styles.

---

# Avatars

Small

36dp

Medium

44dp

Large

72dp

Circular

Never use decorative borders.

---

# Color Philosophy

Use color sparingly.

Primary actions should stand out.

Everything else should rely on hierarchy rather than color.

Avoid excessive accent colors.

---

# Component Rules

Never redesign components per screen.

Never invent new radii.

Never invent new typography.

Never invent new spacing.

Reuse existing components whenever possible.

Every component should feel like it belongs to the same product.

---

# Success Criteria

Users should never notice the components individually.

They should perceive one coherent interface.

Consistency creates trust.

Trust creates quality.

Flow Motion prioritizes consistency over novelty.