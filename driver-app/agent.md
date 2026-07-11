# AGENT_DRIVER.md

# RideWay Driver App Engineering Guide

Version: 1.0

This document defines the architecture, engineering standards, workflows and development philosophy for the RideWay Driver App.

This file supplements the global AGENT.md.

If a conflict exists, AGENT.md takes precedence unless explicitly overridden for driver-specific functionality.

---

# Mission

The Driver App is not a dashboard.

It is a real-time operational application whose primary objective is to help drivers safely and efficiently complete rides.

Every screen, interaction and workflow must reduce cognitive load while driving.

Never design for aesthetics over usability.

---

# Core Philosophy

The Driver App should feel:

Professional

Reliable

Fast

Predictable

Minimal

Every interaction should help drivers complete rides with as few taps as possible.

---

# Driver Workflow

The Driver App exists to complete the following lifecycle:

Launch

↓

Restore Session

↓

Driver Login

↓

Driver Profile Verification

↓

Driver Home

↓

Offline

↓

Go Online

↓

Receive Ride Request

↓

Accept Ride

↓

Navigate to Pickup

↓

Arrived

↓

Wait for Passenger

↓

Start Ride

↓

Navigate to Destination

↓

Complete Ride

↓

Available Again

Never introduce unnecessary intermediate screens.

---

# Engineering Principles

Single Source of Truth.

Avoid duplicated:

Driver state

Ride state

Location state

Authentication

Navigation

Vehicle information

Driver availability

Business logic

Only one component should own each responsibility.

---

# Project Structure

Follow feature-first architecture.

Example:

app/

components/

features/

contexts/

hooks/

services/

utils/

types/

constants/

assets/

Never place business logic inside UI components.

---

# Authentication

Reuse the authentication architecture defined by RideWay.

Requirements:

One AuthProvider

One Session Restoration

One Supabase Listener

One Route Decision

Driver authentication must never diverge from Rider authentication.

Only profile requirements differ.

---

# Driver Profile

Required fields:

Driver Name

Phone Number

Email

Vehicle Type

Vehicle Model

Vehicle Number

Vehicle Color

License Number

Profile Photo

Store using authenticated Driver UUID.

Never use temporary identifiers.

---

# Driver Home

Driver Home contains:

Full-screen Map

Floating Header

Online / Offline Toggle

Ride Status Card

Bottom Sheet

No dashboard clutter.

No unnecessary analytics.

No advertisements.

---

# Bottom Sheet

Always use:

@gorhom/bottom-sheet

Collapsed

Driver Status

Today's Earnings

Current Ride

Expanded

Ride Queue

Navigation Actions

Quick Controls

Future Tasks

Snap Points:

20%

45%

85%

Must support:

Drag

Expand

Collapse

Smooth animations

---

# Online / Offline State

Possible states:

OFFLINE

ONLINE

BUSY

Only ONLINE drivers receive ride requests.

Never allow ride requests while OFFLINE.

---

# Ride Request

Ride request screen must display:

Pickup Address

Destination

Distance to Pickup

Estimated Ride Distance

Estimated Duration

Estimated Earnings

Countdown Timer

Accept

Decline

Never display placeholder rides.

Never display demo data.

---

# Ride Lifecycle

Ride States:

REQUEST_RECEIVED

↓

ACCEPTED

↓

NAVIGATING_TO_PICKUP

↓

ARRIVED

↓

WAITING_FOR_PASSENGER

↓

RIDE_STARTED

↓

NAVIGATING_TO_DESTINATION

↓

RIDE_COMPLETED

↓

AVAILABLE

Every state must have:

Dedicated UI

Dedicated backend event

Dedicated driver action

---

# Maps

Map occupies full screen.

Floating components overlay map.

Never place map inside scroll views.

Never mount multiple map instances.

Only one active navigation session.

---

# GPS

Driver location is mission critical.

Requirements:

High accuracy

Continuous updates

Background updates

Battery optimized

Reconnect automatically after network interruption.

---

# Navigation

Navigation architecture should support:

Current Location

Pickup Route

Destination Route

Voice Guidance (future)

Valhalla Integration (future)

Never tightly couple navigation logic with UI.

---

# State Management

Contexts:

AuthContext

DriverContext

RideContext

LocationContext

UIContext

Each context owns one responsibility.

Never duplicate state.

---

# Networking

Every request must handle:

Loading

Success

Failure

Retry

Timeout

Offline Mode

Never silently fail.

---

# Push Notifications

Ride requests

Ride cancellations

System announcements

Important alerts

Notification handling must be centralized.

---

# Component Guidelines

Every component has one responsibility.

Examples:

DriverMap

RideRequestCard

OnlineToggle

RideBottomSheet

DriverHeader

VehicleCard

Avoid giant screens.

Split components early.

---

# UI Consistency

Driver App follows the global RideWay Design System.

Use identical:

Typography

Spacing

Buttons

Inputs

Cards

Colors

Animations

Icons

Driver-specific layouts are allowed.

Driver-specific styling is not.

---

# Performance

Prioritize:

Fast startup

Low battery usage

Efficient GPS updates

Minimal re-renders

Lazy loading

Avoid unnecessary polling.

---

# Security

Never trust client input.

Backend owns:

Ride assignment

Pricing

Driver availability

Ride validation

The Driver App only displays backend decisions.

---

# Error Handling

Every failure must provide:

Clear message

Recovery option

Retry when appropriate

Never leave drivers without feedback.

---

# Logging

Development:

Meaningful logs only.

Production:

Remove debug logging.

Never expose sensitive information.

---

# Backend Ownership

The Driver App must NEVER decide:

Which ride to receive

Pricing

Commission

Matching

Ride eligibility

Fraud detection

The backend is authoritative.

---

# Shared Code Policy

Reuse shared:

Components

Theme

Services

Hooks

Utilities

Types

Never duplicate code from Rider App.

Extract reusable functionality into shared modules.

---

# Future Features

Architecture should support:

Scheduled Rides

Multi-stop Trips

Driver Wallet

Bonuses

Heatmaps

Ride Reservations

EV Charging

Fleet Management

Without major refactoring.

---

# Before Implementing Any Feature

Verify:

Can this reuse an existing component?

Does it duplicate business logic?

Does it follow the RideWay Design System?

Does it improve architecture?

Does it reduce driver effort?

---

# Code Review Checklist

Before completing any task verify:

✓ No duplicated logic

✓ No duplicated state

✓ No hardcoded data

✓ No placeholder UI

✓ No demo rides

✓ No unnecessary re-renders

✓ Proper error handling

✓ Correct state ownership

✓ Clean component boundaries

✓ Documentation updated

---

# Final Principle

The Driver App is an operational tool, not a showcase.

Every screen should answer one question:

"What is the next action the driver needs to take?"

If the UI does not make that answer immediately obvious, redesign it.

The Driver App should feel reliable enough that a professional driver can depend on it throughout an entire working day.