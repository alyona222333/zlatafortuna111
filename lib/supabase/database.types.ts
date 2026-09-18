export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string
          owner_id: string
          name: string
          slug: string
          type: string | null
          phone: string | null
          email: string | null
          address: string | null
          timezone: string
          currency: string
          logo_url: string | null
          plan: string
          plan_expires_at: string | null
          telegram_bot_token: string | null
          telegram_chat_id: string | null
          viber_bot_token: string | null
          viber_chat_id: string | null
          owner_whatsapp: string | null
          onboarding_completed: boolean
          ls_subscription_id: string | null
          ls_variant_id: string | null
          email_provider: string | null
          smtp_host: string | null
          smtp_port: number | null
          smtp_user: string | null
          smtp_pass: string | null
          smtp_from: string | null
          resend_api_key: string | null
          meta_whatsapp_phone_number_id: string | null
          meta_whatsapp_access_token: string | null
          wa_template_confirmation: string | null
          wa_template_reminder: string | null
          wa_template_thankyou: string | null
          wa_template_reactivation: string | null
          wa_template_birthday: string | null
          wa_template_language: string | null
          brand_color: string | null
          notification_language: string | null
          enabled_modules: string[] | null
          woocommerce_url: string | null
          woocommerce_webhook_secret: string | null
          nova_poshta_api_key: string | null
          liqpay_public_key: string | null
          liqpay_private_key: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          slug: string
          type?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          timezone?: string
          currency?: string
          logo_url?: string | null
          plan?: string
          plan_expires_at?: string | null
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          viber_bot_token?: string | null
          viber_chat_id?: string | null
          owner_whatsapp?: string | null
          onboarding_completed?: boolean
          ls_subscription_id?: string | null
          ls_variant_id?: string | null
          email_provider?: string | null
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          smtp_pass?: string | null
          smtp_from?: string | null
          resend_api_key?: string | null
          meta_whatsapp_phone_number_id?: string | null
          meta_whatsapp_access_token?: string | null
          wa_template_confirmation?: string | null
          wa_template_reminder?: string | null
          wa_template_thankyou?: string | null
          wa_template_reactivation?: string | null
          wa_template_birthday?: string | null
          wa_template_language?: string | null
          brand_color?: string | null
          notification_language?: string | null
          enabled_modules?: string[] | null
          woocommerce_url?: string | null
          woocommerce_webhook_secret?: string | null
          nova_poshta_api_key?: string | null
          liqpay_public_key?: string | null
          liqpay_private_key?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          slug?: string
          type?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          timezone?: string
          currency?: string
          logo_url?: string | null
          plan?: string
          plan_expires_at?: string | null
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          viber_bot_token?: string | null
          viber_chat_id?: string | null
          owner_whatsapp?: string | null
          onboarding_completed?: boolean
          ls_subscription_id?: string | null
          ls_variant_id?: string | null
          email_provider?: string | null
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          smtp_pass?: string | null
          smtp_from?: string | null
          resend_api_key?: string | null
          meta_whatsapp_phone_number_id?: string | null
          meta_whatsapp_access_token?: string | null
          wa_template_confirmation?: string | null
          wa_template_reminder?: string | null
          wa_template_thankyou?: string | null
          wa_template_reactivation?: string | null
          wa_template_birthday?: string | null
          wa_template_language?: string | null
          brand_color?: string | null
          notification_language?: string | null
          enabled_modules?: string[] | null
          woocommerce_url?: string | null
          woocommerce_webhook_secret?: string | null
          nova_poshta_api_key?: string | null
          liqpay_public_key?: string | null
          liqpay_private_key?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: {
          foreignKeyName: string
          columns: string[]
          isOneToOne?: boolean
          referencedRelation: string
          referencedColumns: string[]
        }[]
      }
      messages: {
        Row: {
          id: string
          business_id: string
          client_id: string | null
          channel: string
          direction: string
          body: string
          external_contact_id: string | null
          sent_by: string | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          client_id?: string | null
          channel: string
          direction: string
          body: string
          external_contact_id?: string | null
          sent_by?: string | null
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          client_id?: string | null
          channel?: string
          direction?: string
          body?: string
          external_contact_id?: string | null
          sent_by?: string | null
          read_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      quick_replies: {
        Row: {
          id: string
          business_id: string
          title: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          title: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          title?: string
          body?: string
          created_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          id: string
          business_id: string
          category: string
          description: string | null
          amount: number
          currency: string
          spent_at: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          category?: string
          description?: string | null
          amount: number
          currency?: string
          spent_at?: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          category?: string
          description?: string | null
          amount?: number
          currency?: string
          spent_at?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      order_statuses: {
        Row: {
          id: string
          business_id: string
          key: string
          label: string
          color: string
          sort_order: number
          is_final: boolean
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          key: string
          label: string
          color?: string
          sort_order?: number
          is_final?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          key?: string
          label?: string
          color?: string
          sort_order?: number
          is_final?: boolean
          created_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          business_id: string
          client_id: string | null
          customer_name: string
          customer_phone: string | null
          customer_email: string | null
          source: string
          items: unknown
          total_amount: number
          currency: string
          delivery_method: string
          delivery_city: string | null
          delivery_branch: string | null
          delivery_address: string | null
          ttn_number: string | null
          status: string
          assigned_to: string | null
          notes: string | null
          external_order_id: string | null
          external_source: string | null
          payment_status: string
          liqpay_order_id: string | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          client_id?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_email?: string | null
          source?: string
          items?: unknown
          total_amount?: number
          currency?: string
          delivery_method?: string
          delivery_city?: string | null
          delivery_branch?: string | null
          delivery_address?: string | null
          ttn_number?: string | null
          status?: string
          assigned_to?: string | null
          notes?: string | null
          external_order_id?: string | null
          external_source?: string | null
          payment_status?: string
          liqpay_order_id?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          client_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_email?: string | null
          source?: string
          items?: unknown
          total_amount?: number
          currency?: string
          delivery_method?: string
          delivery_city?: string | null
          delivery_branch?: string | null
          delivery_address?: string | null
          ttn_number?: string | null
          status?: string
          assigned_to?: string | null
          notes?: string | null
          external_order_id?: string | null
          external_source?: string | null
          payment_status?: string
          liqpay_order_id?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          id: string
          business_id: string
          user_id: string | null
          name: string
          role: string
          phone: string | null
          email: string | null
          avatar_url: string | null
          is_active: boolean
          created_at: string
          invite_token: string | null
          invite_expires_at: string | null
          invite_sent_at: string | null
          invite_accepted_at: string | null
        }
        Insert: {
          id?: string
          business_id: string
          user_id?: string | null
          name: string
          role?: string
          phone?: string | null
          email?: string | null
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string
          invite_token?: string | null
          invite_expires_at?: string | null
          invite_sent_at?: string | null
          invite_accepted_at?: string | null
        }
        Update: {
          id?: string
          business_id?: string
          user_id?: string | null
          name?: string
          role?: string
          phone?: string | null
          email?: string | null
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string
          invite_token?: string | null
          invite_expires_at?: string | null
          invite_sent_at?: string | null
          invite_accepted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      services: {
        Row: {
          id: string
          business_id: string
          name: string
          description: string | null
          price: number
          duration_min: number
          category: string | null
          is_active: boolean
          capacity: number
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          description?: string | null
          price: number
          duration_min?: number
          category?: string | null
          is_active?: boolean
          capacity?: number
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          description?: string | null
          price?: number
          duration_min?: number
          category?: string | null
          is_active?: boolean
          capacity?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      clients: {
        Row: {
          id: string
          business_id: string
          name: string
          phone: string | null
          email: string | null
          notes: string | null
          tags: string[]
          telegram_id: string | null
          viber_user_id: string | null
          whatsapp_number: string | null
          birthday: string | null
          total_visits: number
          total_spent: number
          last_visit_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          phone?: string | null
          email?: string | null
          notes?: string | null
          tags?: string[]
          telegram_id?: string | null
          viber_user_id?: string | null
          whatsapp_number?: string | null
          birthday?: string | null
          total_visits?: number
          total_spent?: number
          last_visit_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          phone?: string | null
          email?: string | null
          notes?: string | null
          tags?: string[]
          telegram_id?: string | null
          viber_user_id?: string | null
          whatsapp_number?: string | null
          birthday?: string | null
          total_visits?: number
          total_spent?: number
          last_visit_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      appointments: {
        Row: {
          id: string
          business_id: string
          client_id: string | null
          employee_id: string | null
          service_id: string | null
          starts_at: string
          ends_at: string
          status: string
          price: number | null
          notes: string | null
          source: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          client_id?: string | null
          employee_id?: string | null
          service_id?: string | null
          starts_at: string
          ends_at: string
          status?: string
          price?: number | null
          notes?: string | null
          source?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          client_id?: string | null
          employee_id?: string | null
          service_id?: string | null
          starts_at?: string
          ends_at?: string
          status?: string
          price?: number | null
          notes?: string | null
          source?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          }
        ]
      }
      transactions: {
        Row: {
          id: string
          business_id: string
          appointment_id: string | null
          client_id: string | null
          employee_id: string | null
          amount: number
          payment_method: string
          status: string
          items: Json
          receipt_number: string | null
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          appointment_id?: string | null
          client_id?: string | null
          employee_id?: string | null
          amount: number
          payment_method?: string
          status?: string
          items?: Json
          receipt_number?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          appointment_id?: string | null
          client_id?: string | null
          employee_id?: string | null
          amount?: number
          payment_method?: string
          status?: string
          items?: Json
          receipt_number?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          }
        ]
      }
      inventory_items: {
        Row: {
          id: string
          business_id: string
          name: string
          sku: string | null
          barcode: string | null
          description: string | null
          photo_url: string | null
          category: string | null
          unit: string
          quantity: number
          low_stock_threshold: number
          cost_price: number | null
          sell_price: number | null
          supplier_name: string | null
          supplier_phone: string | null
          supplier_notes: string | null
          created_at: string
          updated_at: string
          source: string
          external_id: string | null
          product_url: string | null
          image_url: string | null
          sku_norm: string | null
          supplier_feed_id: string | null
          supplier_offer_id: string | null
          supplier_available: boolean | null
          supplier_stock: number | null
          supplier_price: number | null
          supplier_url: string | null
          supplier_match_type: string | null
          supplier_checked_at: string | null
          track_supplier: boolean
          is_archived: boolean
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          sku?: string | null
          barcode?: string | null
          description?: string | null
          photo_url?: string | null
          category?: string | null
          unit?: string
          quantity?: number
          low_stock_threshold?: number
          cost_price?: number | null
          sell_price?: number | null
          supplier_name?: string | null
          supplier_phone?: string | null
          supplier_notes?: string | null
          created_at?: string
          updated_at?: string
          source?: string
          external_id?: string | null
          product_url?: string | null
          image_url?: string | null
          sku_norm?: string | null
          supplier_feed_id?: string | null
          supplier_offer_id?: string | null
          supplier_available?: boolean | null
          supplier_stock?: number | null
          supplier_price?: number | null
          supplier_url?: string | null
          supplier_match_type?: string | null
          supplier_checked_at?: string | null
          track_supplier?: boolean
          is_archived?: boolean
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          sku?: string | null
          barcode?: string | null
          description?: string | null
          photo_url?: string | null
          category?: string | null
          unit?: string
          quantity?: number
          low_stock_threshold?: number
          cost_price?: number | null
          sell_price?: number | null
          created_at?: string
          updated_at?: string
          source?: string
          external_id?: string | null
          product_url?: string | null
          image_url?: string | null
          sku_norm?: string | null
          supplier_feed_id?: string | null
          supplier_offer_id?: string | null
          supplier_available?: boolean | null
          supplier_stock?: number | null
          supplier_price?: number | null
          supplier_url?: string | null
          supplier_match_type?: string | null
          supplier_checked_at?: string | null
          track_supplier?: boolean
          is_archived?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      product_sets: {
        Row: {
          id: string
          business_id: string
          name: string
          description: string | null
          price: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          description?: string | null
          price?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          description?: string | null
          price?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_sets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      product_set_items: {
        Row: {
          id: string
          set_id: string
          item_id: string
          quantity: number
        }
        Insert: {
          id?: string
          set_id: string
          item_id: string
          quantity?: number
        }
        Update: {
          id?: string
          set_id?: string
          item_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_set_items_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "product_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_set_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          }
        ]
      }
      supplier_feeds: {
        Row: {
          id: string
          business_id: string
          name: string
          url: string | null
          format: string
          is_active: boolean
          write_quantity: boolean
          default_stock_when_available: number
          last_synced_at: string | null
          last_status: string | null
          last_error: string | null
          last_offers_count: number
          last_matched_count: number
          created_at: string
          updated_at: string
          source_kind: string
          file_name: string | null
          auto_add_items: boolean
          notify_out_of_stock: boolean
          default_markup_percent: number | null
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          url: string | null
          format?: string
          is_active?: boolean
          write_quantity?: boolean
          default_stock_when_available?: number
          last_synced_at?: string | null
          last_status?: string | null
          last_error?: string | null
          last_offers_count?: number
          last_matched_count?: number
          created_at?: string
          updated_at?: string
          source_kind?: string
          file_name?: string | null
          auto_add_items?: boolean
          notify_out_of_stock?: boolean
          default_markup_percent?: number | null
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          url?: string | null
          format?: string
          is_active?: boolean
          write_quantity?: boolean
          default_stock_when_available?: number
          last_synced_at?: string | null
          last_status?: string | null
          last_error?: string | null
          last_offers_count?: number
          last_matched_count?: number
          created_at?: string
          updated_at?: string
          source_kind?: string
          file_name?: string | null
          auto_add_items?: boolean
          notify_out_of_stock?: boolean
          default_markup_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_feeds_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      supplier_offers: {
        Row: {
          id: string
          business_id: string
          feed_id: string
          offer_id: string
          vendor_code: string | null
          vendor_code_norm: string | null
          barcode: string | null
          name: string | null
          name_norm: string | null
          price: number | null
          old_price: number | null
          currency: string | null
          available: boolean
          stock_quantity: number | null
          url: string | null
          picture: string | null
          vendor: string | null
          fetched_at: string
        }
        Insert: {
          id?: string
          business_id: string
          feed_id: string
          offer_id: string
          vendor_code?: string | null
          vendor_code_norm?: string | null
          barcode?: string | null
          name?: string | null
          name_norm?: string | null
          price?: number | null
          old_price?: number | null
          currency?: string | null
          available?: boolean
          stock_quantity?: number | null
          url?: string | null
          picture?: string | null
          vendor?: string | null
          fetched_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          feed_id?: string
          offer_id?: string
          vendor_code?: string | null
          vendor_code_norm?: string | null
          barcode?: string | null
          name?: string | null
          name_norm?: string | null
          price?: number | null
          old_price?: number | null
          currency?: string | null
          available?: boolean
          stock_quantity?: number | null
          url?: string | null
          picture?: string | null
          vendor?: string | null
          fetched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_offers_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "supplier_feeds"
            referencedColumns: ["id"]
          }
        ]
      }
      stock_alerts: {
        Row: {
          id: string
          business_id: string
          item_id: string | null
          feed_id: string | null
          kind: string
          item_name: string | null
          sku: string | null
          supplier_name: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          item_id?: string | null
          feed_id?: string | null
          kind: string
          item_name?: string | null
          sku?: string | null
          supplier_name?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          item_id?: string | null
          feed_id?: string | null
          kind?: string
          item_name?: string | null
          sku?: string | null
          supplier_name?: string | null
          is_read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "supplier_feeds"
            referencedColumns: ["id"]
          }
        ]
      }
      warehouse_settings: {
        Row: {
          business_id: string
          sync_availability: boolean
          missing_offer_policy: string
          auto_sync_minutes: number
          last_matched_at: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          sync_availability?: boolean
          missing_offer_policy?: string
          auto_sync_minutes?: number
          last_matched_at?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          sync_availability?: boolean
          missing_offer_policy?: string
          auto_sync_minutes?: number
          last_matched_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      inventory_movements: {
        Row: {
          id: string
          business_id: string
          item_id: string
          type: string
          quantity: number
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          item_id: string
          type: string
          quantity: number
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          item_id?: string
          type?: string
          quantity?: number
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          }
        ]
      }
      notification_log: {
        Row: {
          id: string
          business_id: string
          ref_id: string
          type: string
          channel: string
          sent_at: string
        }
        Insert: {
          id?: string
          business_id: string
          ref_id: string
          type: string
          channel?: string
          sent_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          ref_id?: string
          type?: string
          channel?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      business_hours: {
        Row: {
          id: string
          business_id: string
          day_of_week: number
          is_open: boolean
          open_time: string
          close_time: string
          break_start: string | null
          break_end: string | null
        }
        Insert: {
          id?: string
          business_id: string
          day_of_week: number
          is_open?: boolean
          open_time?: string
          close_time?: string
          break_start?: string | null
          break_end?: string | null
        }
        Update: {
          id?: string
          business_id?: string
          day_of_week?: number
          is_open?: boolean
          open_time?: string
          close_time?: string
          break_start?: string | null
          break_end?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      supplier_overview: {
        Row: {
          feed_id: string | null
          business_id: string | null
          name: string | null
          source_kind: string | null
          linked_items: number | null
          in_stock_items: number | null
          out_of_stock_items: number | null
        }
        Relationships: []
      }
      warehouse_overview: {
        Row: {
          business_id: string | null
          total_items: number | null
          site_items: number | null
          matched_items: number | null
          in_stock_items: number | null
          out_of_stock_items: number | null
          unmatched_items: number | null
          last_checked_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_booked_slots: {
        Args: Record<string, unknown>
        Returns: {
          starts_at: string
          ends_at: string
        }[]
      }
      get_employee_by_invite_token: {
        Args: { p_token: string }
        Returns: {
          id: string
          business_id: string
          name: string
          email: string | null
          role: string
        }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
