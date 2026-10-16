// Hand-written to match supabase/migrations until the project is linked.
// Regenerate with `npm run db:types` after every migration.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MemberRole = "owner" | "admin" | "technician";

export type ChecklistItemType = "pass_fail" | "number" | "text";

export type DeviceStatus = "active" | "out_of_service" | "removed";

export type InspectionStatus = "in_progress" | "completed";

export type CheckOutcome = "passed" | "failed" | "not_checked";

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
        } & Timestamps;
        Insert: never;
        Update: Partial<{ name: string; inspection_interval_months: number; is_sample: boolean }>;
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
          created_by: string | null;
          deleted_at: string | null;
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
      inspection_items: {
        Row: {
          id: string;
          organization_id: string;
          inspection_id: string;
          device_id: string;
          template_id: string | null;
          outcome: CheckOutcome | null;
          notes: string | null;
          checked_by: string | null;
          checked_at: string | null;
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
      protocols: {
        Row: {
          id: string;
          organization_id: string;
          inspection_id: string;
          year: number;
          number: number;
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
            isOneToOne: true;
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
      start_inspection: { Args: { p_site: string }; Returns: string };
      open_device_check: {
        Args: { p_inspection: string; p_device: string; p_take_over?: boolean };
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
      ensure_protocol: { Args: { p_inspection: string }; Returns: string };
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
      complete_inspection: { Args: { p_inspection: string; p_notes?: string | null }; Returns: Json };
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
    };
    CompositeTypes: Record<string, never>;
  };
};
