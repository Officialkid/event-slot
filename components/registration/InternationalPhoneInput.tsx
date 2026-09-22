"use client"

import React, { useState, useRef, useEffect } from "react"

export interface CountryInfo {
  code: string
  name: string
  dialCode: string
  flag: string
}

export const POPULAR_COUNTRIES: CountryInfo[] = [
  { code: "KE", name: "Kenya", dialCode: "+254", flag: "🇰🇪" },
  { code: "US", name: "United States", dialCode: "+1", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧" },
  { code: "DK", name: "Denmark", dialCode: "+45", flag: "🇩🇰" },
  { code: "UG", name: "Uganda", dialCode: "+256", flag: "🇺🇬" },
  { code: "TZ", name: "Tanzania", dialCode: "+255", flag: "🇹🇿" },
  { code: "RW", name: "Rwanda", dialCode: "+250", flag: "🇷🇼" },
  { code: "NG", name: "Nigeria", dialCode: "+234", flag: "🇳🇬" },
  { code: "GH", name: "Ghana", dialCode: "+233", flag: "🇬🇭" },
  { code: "ZA", name: "South Africa", dialCode: "+27", flag: "🇿🇦" },
  { code: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦" },
  { code: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪" },
  { code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷" },
  { code: "IN", name: "India", dialCode: "+91", flag: "🇮🇳" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪" },
  { code: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺" },
  { code: "NL", name: "Netherlands", dialCode: "+31", flag: "🇳🇱" },
  { code: "SE", name: "Sweden", dialCode: "+46", flag: "🇸🇪" },
  { code: "NO", name: "Norway", dialCode: "+47", flag: "🇳🇴" },
  { code: "CH", name: "Switzerland", dialCode: "+41", flag: "🇨🇭" },
  { code: "IE", name: "Ireland", dialCode: "+353", flag: "🇮🇪" },
  { code: "IT", name: "Italy", dialCode: "+39", flag: "🇮🇹" },
  { code: "ES", name: "Spain", dialCode: "+34", flag: "🇪🇸" },
]

interface InternationalPhoneInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  placeholder?: string
  hasError?: boolean
  className?: string
  style?: React.CSSProperties
}

export function parsePhoneNumberParts(value: string): { country: CountryInfo; localNumber: string } {
  const trimmed = value.trim()
  if (trimmed.startsWith("+")) {
    for (const c of POPULAR_COUNTRIES) {
      if (trimmed.startsWith(c.dialCode)) {
        return {
          country: c,
          localNumber: trimmed.slice(c.dialCode.length).trim(),
        }
      }
    }
  } else if (trimmed.startsWith("0") && trimmed.length >= 10) {
    return {
      country: POPULAR_COUNTRIES[0], // KE
      localNumber: trimmed,
    }
  }
  return {
    country: POPULAR_COUNTRIES[0], // Default Kenya (+254)
    localNumber: trimmed,
  }
}

export function InternationalPhoneInput({
  id,
  value,
  onChange,
  required,
  disabled,
  placeholder = "712 345 678",
  hasError,
  className = "",
  style,
}: InternationalPhoneInputProps) {
  const { country: initialCountry, localNumber: initialLocal } = parsePhoneNumberParts(value)
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(initialCountry)
  const [localNumber, setLocalNumber] = useState<string>(initialLocal)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const { country, localNumber: parsedLocal } = parsePhoneNumberParts(value)
    if (value.startsWith("+")) {
      setSelectedCountry(country)
      setLocalNumber(parsedLocal)
    } else if (value !== localNumber && !value.startsWith("+")) {
      setLocalNumber(value)
    }
  }, [value])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [dropdownOpen])

  useEffect(() => {
    if (dropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [dropdownOpen])

  const handleLocalChange = (newLocal: string) => {
    setLocalNumber(newLocal)
    const cleaned = newLocal.trim().replace(/\s+/g, "")
    if (!cleaned) {
      onChange("")
      return
    }
    if (cleaned.startsWith("0")) {
      onChange(`${selectedCountry.dialCode}${cleaned.slice(1)}`)
    } else if (cleaned.startsWith("+")) {
      onChange(cleaned)
    } else {
      onChange(`${selectedCountry.dialCode}${cleaned}`)
    }
  }

  const handleSelectCountry = (country: CountryInfo) => {
    setSelectedCountry(country)
    setDropdownOpen(false)
    setSearchQuery("")
    const cleaned = localNumber.trim().replace(/\s+/g, "")
    if (cleaned) {
      const stripped = cleaned.startsWith("0") ? cleaned.slice(1) : cleaned
      onChange(`${country.dialCode}${stripped}`)
    }
  }

  const filteredCountries = POPULAR_COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.dialCode.includes(searchQuery) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      <div
        className="flex items-center w-full rounded-[12px] border transition-all duration-200 focus-within:ring-2 focus-within:ring-[#C8F55A]"
        style={{
          background: "var(--bg-input)",
          borderColor: hasError
            ? "#EF4444"
            : "color-mix(in srgb, var(--text-primary) 14%, transparent)",
          boxShadow: hasError ? "0 0 0 1px #EF4444" : undefined,
          ...style,
        }}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="flex items-center gap-1.5 px-3 py-3 border-r text-[0.875rem] font-medium transition select-none hover:bg-[color-mix(in_srgb,var(--text-primary)_4%,transparent)]"
          style={{
            borderColor: "color-mix(in srgb, var(--text-primary) 12%, transparent)",
            color: "var(--text-primary)",
          }}
          aria-label={`Select country code, current: ${selectedCountry.name} ${selectedCountry.dialCode}`}
        >
          <span className="text-base leading-none">{selectedCountry.flag}</span>
          <span className="text-[0.8rem] font-mono text-[var(--text-secondary)]">{selectedCountry.dialCode}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`transition-transform text-[var(--text-muted)] ${dropdownOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          value={localNumber}
          onChange={(e) => handleLocalChange(e.target.value)}
          className="flex-1 bg-transparent px-3.5 py-3 text-[0.9rem] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
        />
      </div>

      {dropdownOpen && (
        <div
          className="absolute left-0 top-full mt-1.5 w-72 max-h-64 overflow-y-auto rounded-[14px] border shadow-2xl z-50 p-2 backdrop-blur-md"
          style={{
            background: "color-mix(in srgb, var(--surface) 96%, white 4%)",
            borderColor: "color-mix(in srgb, var(--text-primary) 15%, transparent)",
          }}
        >
          <div className="p-1 mb-1">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search country or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-[8px] border px-2.5 py-1.5 text-[0.8rem] bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#C8F55A]"
              style={{ borderColor: "color-mix(in srgb, var(--text-primary) 12%, transparent)" }}
            />
          </div>

          <div className="space-y-0.5">
            {filteredCountries.map((country) => {
              const isSelected = country.code === selectedCountry.code
              return (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => handleSelectCountry(country)}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-[8px] text-[0.82rem] text-left transition hover:bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)]"
                  style={{
                    background: isSelected ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "transparent",
                    color: isSelected ? "var(--accent)" : "var(--text-primary)",
                  }}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-base">{country.flag}</span>
                    <span className="truncate">{country.name}</span>
                  </div>
                  <span className="text-[0.78rem] font-mono text-[var(--text-muted)] ml-2">
                    {country.dialCode}
                  </span>
                </button>
              )
            })}
            {filteredCountries.length === 0 && (
              <p className="px-3 py-3 text-center text-[0.78rem] text-[var(--text-muted)]">
                No matching country found
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
