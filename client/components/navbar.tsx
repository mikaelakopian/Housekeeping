"use client";

import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarMenu,
  NavbarMenuToggle,
  NavbarBrand,
  NavbarItem,
  NavbarMenuItem,
} from "@heroui/react";
import { Link } from "@heroui/react";
import NextLink from "next/link";
import Image from "next/image";
import clsx from "clsx";
import { link as linkStyles } from "@heroui/theme";

import { Clock } from "@/components/clock";
// import { ThemeSwitch } from "@/components/theme-switch";
// import { Logo } from "@/components/icons";

// Define navigation items
const navItems = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "Employees",
    href: "/employees",
  },
  {
    label: "Tasks",
    href: "/tasks",
  },
];

export const Navbar = () => {
  return (
    <HeroUINavbar
      className="bg-primary-100 border-b border-primary-200"
      maxWidth="xl"
      position="sticky"
    >
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand as="li" className="gap-3 max-w-fit">
          <NextLink className="flex justify-start items-center gap-1" href="/">
            <Image
              alt="Tatenhove Housekeeping"
              className="h-auto"
              height={45}
              src="/img/logo.png"
              style={{ width: "auto", height: 45 }}
              width={140}
            />
          </NextLink>
        </NavbarBrand>
        <ul className="hidden lg:flex gap-4 justify-start ml-2">
          {navItems.map((item) => (
            <NavbarItem key={item.href}>
              <NextLink
                className={clsx(
                  linkStyles({ color: "foreground" }),
                  "text-primary-700 hover:text-primary-900 data-[active=true]:text-primary-600 data-[active=true]:font-medium",
                )}
                href={item.href}
              >
                {item.label}
              </NextLink>
            </NavbarItem>
          ))}
        </ul>
      </NavbarContent>

      <NavbarContent
        className="hidden sm:flex basis-1/5 sm:basis-full"
        justify="end"
      >
        <NavbarItem className="flex gap-2">
          <Clock />
        </NavbarItem>
      </NavbarContent>

      <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
        <div className="mr-2">
          <Clock />
        </div>
        <NavbarMenuToggle />
      </NavbarContent>

      <NavbarMenu className="bg-primary-50">
        <div className="mx-4 mt-2 flex flex-col gap-2">
          {navItems.map((item, index) => (
            <NavbarMenuItem key={`${item.label}-${index}`}>
              <Link
                className="text-primary-700 hover:text-primary-900"
                href={item.href}
                size="lg"
              >
                {item.label}
              </Link>
            </NavbarMenuItem>
          ))}
        </div>
      </NavbarMenu>
    </HeroUINavbar>
  );
};
