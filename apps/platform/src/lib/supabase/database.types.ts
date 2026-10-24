// Hand-written to match supabase/migrations until the project is linked.
// Regenerate with `npm run db:types` after every migration.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MemberRole = "owner" | "admin" | "technician";

export type ChecklistItemType = "pass_fail" | "number" | "text";

export type DeviceStatus = "active" | "out_of_service" | "removed";

export type InspectionStatus = "in_progress" | "completed";
export type ProtocolNumberFormat = "year_number" | "number_year" | "year_slash_number";

export type CheckOutcome = "passed" | "failed" | "not_checked";

/** Why a device was left out of an inspection (outcome not_checked). */
export type CheckSkipReason = "inaccessible" | "missing";

export type DefectSeverity = "minor" | "major" | "critical";

export type DefectStatus = "open" | "in_progress" | "resolved";

export type DefectEventKind =
  | "created"
  | "status"
  | "severity"
  | "description"
  | "comment"
  | "observed";

type Timestamps = { created_at: string; updated_at: string };

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          legal_name: string | null;
          company_id: string | null;
          vat_id: string | null;
          address: string | null;
          email: string | null;
          phone: string | null;
          logo_path: string | null;
          default_locale: string;
          protocol_footer_text: string | null;
          protocol_number_format: ProtocolNumberFormat;
          settings: Json;
          timezone: string;
          due_soon_days: number;
          weekly_digest: boolean;
          labels_printed_at: string | null;
          guide_dismissed_at: string | null;
        } & Timestamps;
        Insert: never;
        Update: Partial<{
          name: string;
          legal_name: string | null;
          company_id: string | null;
          vat_id: string | null;
          address: string | null;
          email: string | null;
          phone: string | null;
          logo_path: string | null;
          default_locale: string;
          protocol_footer_text: string | null;
          protocol_number_format: ProtocolNumberFormat;
          settings: Json;
          timezone: string;
          due_soon_days: number;
          weekly_digest: boolean;
          guide_dismissed_at: string | null;
        }>;
        Relationships: [];
      };
      organization_digests: {
        Row: {
          id: string;
          organization_id: string;
          week: string;
          recipients: number;
          sent_at: string;
        };
        // Only the service role writes (src/lib/digests.ts).
        Insert: { organization_id: string; week: string; recipients: number };
        Update: { recipients?: number };
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: MemberRole;
          display_name: string;
          email: string;
        } & Timestamps;
        Insert: never;
        Update: { display_name?: string };
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: MemberRole;
          token_hash: string;
          invited_by: string;
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
        } & Timestamps;
        Insert: {
          organization_id: string;
          email: string;
          role: MemberRole;
          token_hash: string;
          invited_by: string;
          expires_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          company_id: string | null;
          vat_id: string | null;
          contact_person: string | null;
          email: string | null;
          phone: string | null;
          billing_address: string | null;
          notes: string | null;
          created_by: string | null;
          deleted_at: string | null;
          /** Sample data (create_sample_data); removed with remove_sample_data. */
          is_sample: boolean;
          /** The import that created it (import_records), if any. */
          import_id: string | null;
        } & Timestamps;
        Insert: {
          organization_id: string;
          name: string;
          company_id?: string | null;
          vat_id?: string | null;
          contact_person?: string | null;
          email?: string | null;
          phone?: string | null;
          billing_address?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: Partial<{
          name: string;
          company_id: string | null;
          vat_id: string | null;
          contact_person: string | null;
          email: string | null;
          phone: string | null;
          billing_address: string | null;
          notes: string | null;
          deleted_at: string | null;
        }>;
        Relationships: [];
      };
      sites: {
        Row: {
          id: string;
          organization_id: string;
          customer_id: string;
          name: string;
          address: string | null;
          access_notes: string | null;
          notes: string | null;
          created_by: string | null;
          deleted_at: string | null;
          import_id: string | null;
        } & Timestamps;
        Insert: {
          organization_id: string;
          customer_id: string;
          name: string;
          address?: string | null;
          access_notes?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: Partial<{
          name: string;
          address: string | null;
          access_notes: string | null;
          notes: string | null;
          deleted_at: string | null;
        }>;
        Relationships: [
          {
            foreignKeyName: "sites_customer_id_organization_id_fkey";
            columns: ["customer_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      locations: {
        Row: {
          id: string;
          organization_id: string;
          site_id: string;
          name: string;
          sort_order: number;
          import_id: string | null;
        } & Timestamps;
        Insert: { organization_id: string; site_id: string; name: string; sort_order?: number };
        Update: Partial<{ name: string; sort_order: number }>;
        Relationships: [
          {
            foreignKeyName: "locations_site_id_organization_id_fkey";
            columns: ["site_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      device_types: {
        Row: {
          id: string;
          organization_id: string;
          code: string;
          name: string;
          inspection_interval_months: number;
          is_sample: boolean;
          active: boolean;
          /** {key, label}[]: which fields devices.attributes holds for this type. */
          custom_fields: Json;
        } & Timestamps;
        Insert: {
          organization_id: string;
          code: string;
          name: string;
          inspection_interval_months: number;
          custom_fields?: Json;
        };
        Update: Partial<{
          name: string;
          inspection_interval_months: number;
          is_sample: boolean;
          custom_fields: Json;
        }>;
        Relationships: [];
      };
      checklist_templates: {
        Row: {
          id: string;
          organization_id: string;
          device_type_id: string;
          version: number;
          name: string;
          is_sample: boolean;
          active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "checklist_templates_device_type_id_organization_id_fkey";
            columns: ["device_type_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "device_types";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      checklist_template_items: {
        Row: {
          id: string;
          organization_id: string;
          template_id: string;
          sort_order: number;
          label: string;
          item_type: ChecklistItemType;
          required: boolean;
          fail_creates_defect: boolean;
          photo_required: boolean;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_template_id_organization_id_fkey";
            columns: ["template_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "checklist_templates";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      devices: {
        Row: {
          id: string;
          organization_id: string;
          site_id: string;
          location_id: string | null;
          device_type_id: string;
          label_number: number;
          public_token: string;
          serial_number: string | null;
          manufacturer: string | null;
          model: string | null;
          manufacture_year: number | null;
          attributes: Json;
          installed_on: string | null;
          status: DeviceStatus;
          last_inspection_on: string | null;
          next_due_on: string | null;
          notes: string | null;
          /** A date to plan replacement around; warned about the same way as a due date. */
          end_of_life_on: string | null;
          created_by: string | null;
          deleted_at: string | null;
          import_id: string | null;
          /** The inspection it was added in (add_inspection_device), if any. */
          added_in_inspection: string | null;
        } & Timestamps;
        // label_number, public_token and next_due_on come from the database.
        Insert: {
          organization_id: string;
          site_id: string;
          device_type_id: string;
          location_id?: string | null;
          serial_number?: string | null;
          manufacturer?: string | null;
          model?: string | null;
          manufacture_year?: number | null;
          attributes?: Json;
          installed_on?: string | null;
          status?: DeviceStatus;
          last_inspection_on?: string | null;
          notes?: string | null;
          end_of_life_on?: string | null;
          created_by?: string | null;
        };
        Update: Partial<{
          location_id: string | null;
          device_type_id: string;
          serial_number: string | null;
          manufacturer: string | null;
          model: string | null;
          manufacture_year: number | null;
          attributes: Json;
          installed_on: string | null;
          status: DeviceStatus;
          last_inspection_on: string | null;
          notes: string | null;
          end_of_life_on: string | null;
          deleted_at: string | null;
        }>;
        Relationships: [
          {
            foreignKeyName: "devices_site_id_organization_id_fkey";
            columns: ["site_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "devices_location_id_site_id_fkey";
            columns: ["location_id", "site_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id", "site_id"];
          },
          {
            foreignKeyName: "devices_device_type_id_organization_id_fkey";
            columns: ["device_type_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "device_types";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      imports: {
        Row: {
          id: string;
          organization_id: string;
          file_name: string;
          customers_created: number;
          sites_created: number;
          locations_created: number;
          devices_created: number;
          devices_skipped: number;
          created_by: string | null;
          created_at: string;
          undone_at: string | null;
          undone_by: string | null;
        };
        // Written only by import_records and undo_import.
        Insert: never;
        Update: never;
        Relationships: [];
      };
      floor_plans: {
        Row: {
          id: string;
          organization_id: string;
          site_id: string;
          location_id: string | null;
          name: string;
          sort_order: number;
          /** "<organization_id>/floor-plans/..." in org-assets. */
          image_path: string;
          image_width: number;
          image_height: number;
          created_by: string | null;
        } & Timestamps;
        Insert: {
          organization_id: string;
          site_id: string;
          location_id?: string | null;
          name: string;
          sort_order?: number;
          image_path: string;
          image_width: number;
          image_height: number;
        };
        Update: Partial<{
          location_id: string | null;
          name: string;
          sort_order: number;
          image_path: string;
          image_width: number;
          image_height: number;
        }>;
        Relationships: [
          {
            foreignKeyName: "floor_plans_site_id_organization_id_fkey";
            columns: ["site_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "floor_plans_location_id_site_id_fkey";
            columns: ["location_id", "site_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id", "site_id"];
          },
        ];
      };
      device_placements: {
        Row: {
          device_id: string;
          organization_id: string;
          site_id: string;
          floor_plan_id: string;
          /** Position relative to the plan image, 0..1 from the left and top. */
          x: number;
          y: number;
          updated_by: string | null;
        } & Timestamps;
        Insert: {
          device_id: string;
          organization_id: string;
          site_id: string;
          floor_plan_id: string;
          x: number;
          y: number;
        };
        Update: Partial<{ floor_plan_id: string; x: number; y: number }>;
        Relationships: [
          {
            foreignKeyName: "device_placements_device_id_site_id_fkey";
            columns: ["device_id", "site_id"];
            isOneToOne: true;
            referencedRelation: "devices";
            referencedColumns: ["id", "site_id"];
          },
          {
            foreignKeyName: "device_placements_floor_plan_id_site_id_fkey";
            columns: ["floor_plan_id", "site_id"];
            isOneToOne: false;
            referencedRelation: "floor_plans";
            referencedColumns: ["id", "site_id"];
          },
          {
            foreignKeyName: "device_placements_site_id_organization_id_fkey";
            columns: ["site_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      inspections: {
        Row: {
          id: string;
          organization_id: string;
          site_id: string;
          status: InspectionStatus;
          started_by: string | null;
          started_at: string;
          completed_by: string | null;
          completed_at: string | null;
          notes: string | null;
          reopened_at: string | null;
          customer_signature_path: string | null;
          customer_signer_name: string | null;
          customer_signed_at: string | null;
        } & Timestamps;
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "inspections_site_id_organization_id_fkey";
            columns: ["site_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      inspection_reopenings: {
        Row: {
          id: string;
          organization_id: string;
          inspection_id: string;
          reopened_by: string | null;
          reopened_at: string;
          reason: string;
          previous_completed_at: string | null;
          previous_completed_by: string | null;
          completed_at: string | null;
          completed_by: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "inspection_reopenings_inspection_id_organization_id_fkey";
            columns: ["inspection_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      inspection_items: {
        Row: {
          id: string;
          organization_id: string;
          inspection_id: string;
          device_id: string;
          template_id: string | null;
          outcome: CheckOutcome | null;
          skip_reason: CheckSkipReason | null;
          notes: string | null;
          checked_by: string | null;
          checked_at: string | null;
          /** The first finished result's time and technician (a correction keeps them). */
          original_checked_at: string | null;
          original_checked_by: string | null;
          device_last_before: string | null;
          device_last_known: boolean;
          editing_by: string | null;
          editing_at: string | null;
        } & Timestamps;
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "inspection_items_inspection_id_organization_id_fkey";
            columns: ["inspection_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inspection_items_device_id_organization_id_fkey";
            columns: ["device_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inspection_items_template_id_organization_id_fkey";
            columns: ["template_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "checklist_templates";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      inspection_answers: {
        Row: {
          id: string;
          organization_id: string;
          item_id: string;
          template_item_id: string;
          value_pass: boolean | null;
          value_number: number | null;
          value_text: string | null;
          note: string | null;
          defect_severity: DefectSeverity | null;
          answered_by: string | null;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "inspection_answers_item_id_organization_id_fkey";
            columns: ["item_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inspection_items";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inspection_answers_template_item_id_fkey";
            columns: ["template_item_id"];
            isOneToOne: false;
            referencedRelation: "checklist_template_items";
            referencedColumns: ["id"];
          },
        ];
      };
      inspection_photos: {
        Row: {
          id: string;
          organization_id: string;
          item_id: string;
          template_item_id: string | null;
          storage_path: string;
          content_type: string;
          size_bytes: number;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "inspection_photos_item_id_organization_id_fkey";
            columns: ["item_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inspection_items";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      defects: {
        Row: {
          id: string;
          organization_id: string;
          number: number;
          device_id: string;
          inspection_id: string | null;
          inspection_item_id: string | null;
          template_item_id: string | null;
          description: string;
          severity: DefectSeverity;
          status: DefectStatus;
          created_by: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          resolution_note: string | null;
        } & Timestamps;
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "defects_device_id_organization_id_fkey";
            columns: ["device_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "defects_inspection_id_fkey";
            columns: ["inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "defects_inspection_item_id_fkey";
            columns: ["inspection_item_id"];
            isOneToOne: false;
            referencedRelation: "inspection_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "defects_template_item_id_fkey";
            columns: ["template_item_id"];
            isOneToOne: false;
            referencedRelation: "checklist_template_items";
            referencedColumns: ["id"];
          },
        ];
      };
      defect_events: {
        Row: {
          id: string;
          organization_id: string;
          defect_id: string;
          kind: DefectEventKind;
          actor: string | null;
          from_value: string | null;
          to_value: string | null;
          note: string | null;
          inspection_id: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "defect_events_defect_id_organization_id_fkey";
            columns: ["defect_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "defects";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "defect_events_inspection_id_fkey";
            columns: ["inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          },
        ];
      };
      defect_photos: {
        Row: {
          id: string;
          organization_id: string;
          defect_id: string;
          storage_path: string;
          content_type: string;
          size_bytes: number;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "defect_photos_defect_id_organization_id_fkey";
            columns: ["defect_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "defects";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      device_photos: {
        Row: {
          id: string;
          organization_id: string;
          device_id: string;
          storage_path: string;
          content_type: string;
          size_bytes: number;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "device_photos_device_id_organization_id_fkey";
            columns: ["device_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      device_moves: {
        Row: {
          id: string;
          organization_id: string;
          device_id: string;
          from_site_id: string;
          to_site_id: string;
          from_location_name: string | null;
          to_location_name: string | null;
          note: string | null;
          moved_by: string | null;
          moved_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "device_moves_device_id_organization_id_fkey";
            columns: ["device_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "device_moves_from_site_id_organization_id_fkey";
            columns: ["from_site_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "device_moves_to_site_id_organization_id_fkey";
            columns: ["to_site_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      protocols: {
        Row: {
          id: string;
          organization_id: string;
          inspection_id: string;
          year: number;
          number: number;
          version: number;
          active: boolean;
          superseded_at: string | null;
          number_format: ProtocolNumberFormat;
          locale: "cs" | "en";
          pdf_path: string | null;
          pdf_size: number | null;
          generated_at: string | null;
          created_at: string;
        };
        Insert: never;
        // Only the service role writes these (src/lib/protocols.ts); RLS has no update policy.
        Update: { pdf_path?: string; pdf_size?: number; generated_at?: string };
        Relationships: [
          {
            foreignKeyName: "protocols_inspection_id_organization_id_fkey";
            columns: ["inspection_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      protocol_emails: {
        Row: {
          id: string;
          organization_id: string;
          protocol_id: string;
          recipient: string;
          sent_by: string | null;
          sent_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "protocol_emails_protocol_id_organization_id_fkey";
            columns: ["protocol_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "protocols";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_member: { Args: { p_org: string }; Returns: boolean };
      has_role: { Args: { p_org: string; p_roles: MemberRole[] }; Returns: boolean };
      create_organization: {
        Args: { p_name: string; p_display_name: string; p_locale?: string };
        Returns: string;
      };
      save_checklist_template: {
        Args: { p_device_type: string; p_name: string; p_items: Json; p_verified?: boolean };
        Returns: string;
      };
      accept_invitation: { Args: { p_token: string; p_display_name: string }; Returns: string };
      change_member_role: { Args: { p_membership: string; p_role: MemberRole }; Returns: undefined };
      remove_member: { Args: { p_membership: string }; Returns: undefined };
      transfer_ownership: { Args: { p_membership: string }; Returns: undefined };
      reorder_locations: { Args: { p_site: string; p_ordered: string[] }; Returns: undefined };
      reorder_floor_plans: { Args: { p_site: string; p_ordered: string[] }; Returns: undefined };
      import_records: {
        Args: { p_org: string; p_file_name: string; p_rows: Json };
        Returns: Json;
      };
      undo_import: { Args: { p_import: string }; Returns: undefined };
      skip_device_check: {
        Args: { p_item: string; p_reason: CheckSkipReason; p_note?: string | null };
        Returns: undefined;
      };
      add_inspection_device: {
        Args: {
          p_inspection: string;
          p_device_type: string;
          p_location?: string | null;
          p_serial_number?: string | null;
          p_manufacturer?: string | null;
          p_model?: string | null;
          p_manufacture_year?: number | null;
          p_attributes?: Json;
          p_notes?: string | null;
        };
        Returns: string;
      };
      cancel_inspection: { Args: { p_inspection: string }; Returns: { path: string }[] };
      place_device: {
        Args: { p_device: string; p_plan: string; p_x: number; p_y: number };
        Returns: undefined;
      };
      start_inspection: { Args: { p_site: string }; Returns: string };
      open_device_check: {
        Args: { p_inspection: string; p_device: string; p_take_over?: boolean };
        Returns: Json;
      };
      claim_device_check: {
        Args: {
          p_inspection: string;
          p_device: string;
          p_template?: string | null;
          p_seen?: string | null;
          p_take_over?: boolean;
        };
        Returns: Json;
      };
      submit_device_check: {
        Args: {
          p_item: string;
          p_answers?: Json;
          p_notes?: string | null;
          p_set_notes?: boolean;
          p_action?: "save" | "finish" | "skip";
          p_skip_reason?: CheckSkipReason | null;
          p_checked_at?: string | null;
          p_replace?: boolean;
          p_release?: boolean;
        };
        Returns: Json;
      };
      release_device_check: { Args: { p_item: string }; Returns: undefined };
      save_answer: {
        Args: {
          p_item: string;
          p_template_item: string;
          p_value_pass?: boolean | null;
          p_value_number?: number | null;
          p_value_text?: string | null;
          p_note?: string | null;
          p_defect_severity?: DefectSeverity | null;
        };
        Returns: string;
      };
      create_defect: {
        Args: { p_device: string; p_description: string; p_severity: DefectSeverity };
        Returns: string;
      };
      change_defect_status: {
        Args: { p_defect: string; p_status: DefectStatus; p_note?: string | null };
        Returns: undefined;
      };
      change_defect_severity: {
        Args: { p_defect: string; p_severity: DefectSeverity };
        Returns: undefined;
      };
      edit_defect_description: {
        Args: { p_defect: string; p_description: string };
        Returns: undefined;
      };
      comment_defect: { Args: { p_defect: string; p_note: string }; Returns: undefined };
      add_defect_photo: {
        Args: { p_defect: string; p_path: string; p_content_type: string; p_size: number };
        Returns: string;
      };
      add_device_photo: {
        Args: { p_device: string; p_path: string; p_content_type: string; p_size: number };
        Returns: string;
      };
      delete_device_photo: { Args: { p_photo: string }; Returns: string };
      move_device: {
        Args: { p_device: string; p_site: string; p_location: string | null; p_note: string | null };
        Returns: undefined;
      };
      ensure_protocol: { Args: { p_inspection: string }; Returns: string };
      reopen_inspection: { Args: { p_inspection: string; p_reason: string }; Returns: undefined };
      note_labels_printed: { Args: { p_org: string }; Returns: undefined };
      create_sample_data: { Args: { p_org: string }; Returns: string };
      remove_sample_data: { Args: { p_org: string }; Returns: { bucket: string; path: string }[] };
      record_protocol_email: { Args: { p_protocol: string; p_recipient: string }; Returns: string };
      save_check_note: { Args: { p_item: string; p_notes: string | null }; Returns: undefined };
      finish_device_check: { Args: { p_item: string }; Returns: CheckOutcome };
      add_inspection_photo: {
        Args: {
          p_item: string;
          p_template_item: string | null;
          p_path: string;
          p_content_type: string;
          p_size: number;
        };
        Returns: string;
      };
      delete_inspection_photo: { Args: { p_photo: string }; Returns: string };
      complete_inspection: {
        Args: {
          p_inspection: string;
          p_notes?: string | null;
          p_signature_path?: string | null;
          p_signer_name?: string | null;
        };
        Returns: Json;
      };
      get_invitation: {
        Args: { p_token: string };
        Returns: {
          organization_name: string;
          role: MemberRole;
          email: string;
          expired: boolean;
          accepted: boolean;
        }[];
      };
    };
    Enums: {
      member_role: MemberRole;
      checklist_item_type: ChecklistItemType;
      device_status: DeviceStatus;
      inspection_status: InspectionStatus;
      check_outcome: CheckOutcome;
      defect_severity: DefectSeverity;
      defect_status: DefectStatus;
      protocol_number_format: ProtocolNumberFormat;
    };
    CompositeTypes: Record<string, never>;
  };
};
