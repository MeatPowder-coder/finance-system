--
-- PostgreSQL database dump
--

\restrict pw8x1etYhWu4FeSMWYaQkapNib4XIQDaw0OKF2IZDnBdp0eOhMIdXo3ee6yP5pt

-- Dumped from database version 18.1 (Debian 18.1-1.pgdg12+2)
-- Dumped by pg_dump version 18.1 (Debian 18.1-1.pgdg12+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: chat_history; Type: TABLE; Schema: public; Owner: root
--

CREATE TABLE public.chat_history (
    id integer NOT NULL,
    message_id bigint,
    chat_id bigint,
    sender character varying(20),
    text text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.chat_history OWNER TO root;

--
-- Name: chat_history_id_seq; Type: SEQUENCE; Schema: public; Owner: root
--

CREATE SEQUENCE public.chat_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_history_id_seq OWNER TO root;

--
-- Name: chat_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: root
--

ALTER SEQUENCE public.chat_history_id_seq OWNED BY public.chat_history.id;


--
-- Name: chat_uploads; Type: TABLE; Schema: public; Owner: root
--

CREATE TABLE public.chat_uploads (
    id integer NOT NULL,
    chat_id bigint NOT NULL,
    file_url text NOT NULL,
    tipo_imagen character varying(20),
    created_at timestamp with time zone DEFAULT now(),
    image_analysis text
);


ALTER TABLE public.chat_uploads OWNER TO root;

--
-- Name: chat_uploads_id_seq; Type: SEQUENCE; Schema: public; Owner: root
--

CREATE SEQUENCE public.chat_uploads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_uploads_id_seq OWNER TO root;

--
-- Name: chat_uploads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: root
--

ALTER SEQUENCE public.chat_uploads_id_seq OWNED BY public.chat_uploads.id;


--
-- Name: desktop_device_sessions; Type: TABLE; Schema: public; Owner: root
--

CREATE TABLE public.desktop_device_sessions (
    id bigint NOT NULL,
    pairing_id uuid NOT NULL,
    pairing_code character varying(12) NOT NULL,
    poll_token_hash character varying(128),
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    user_id character varying(120),
    user_email character varying(255),
    user_name character varying(120),
    client_name character varying(120),
    client_platform character varying(40),
    access_token_jti character varying(64),
    refresh_token_hash character varying(128),
    refresh_expires_at timestamp with time zone,
    approved_at timestamp with time zone,
    exchanged_at timestamp with time zone,
    revoked_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT desktop_device_sessions_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'EXCHANGED'::character varying, 'REVOKED'::character varying, 'EXPIRED'::character varying])::text[])))
);


ALTER TABLE public.desktop_device_sessions OWNER TO root;

--
-- Name: desktop_device_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: root
--

CREATE SEQUENCE public.desktop_device_sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.desktop_device_sessions_id_seq OWNER TO root;

--
-- Name: desktop_device_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: root
--

ALTER SEQUENCE public.desktop_device_sessions_id_seq OWNED BY public.desktop_device_sessions.id;


--
-- Name: lang_ai_memory; Type: TABLE; Schema: public; Owner: root
--

CREATE TABLE public.lang_ai_memory (
    id bigint NOT NULL,
    session_id text NOT NULL,
    message jsonb NOT NULL
);


ALTER TABLE public.lang_ai_memory OWNER TO root;

--
-- Name: lang_ai_memory_id_seq; Type: SEQUENCE; Schema: public; Owner: root
--

CREATE SEQUENCE public.lang_ai_memory_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lang_ai_memory_id_seq OWNER TO root;

--
-- Name: lang_ai_memory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: root
--

ALTER SEQUENCE public.lang_ai_memory_id_seq OWNED BY public.lang_ai_memory.id;


--
-- Name: react_chat_messages; Type: TABLE; Schema: public; Owner: root
--

CREATE TABLE public.react_chat_messages (
    id integer NOT NULL,
    session_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    file_url text,
    file_type text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT react_chat_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])))
);


ALTER TABLE public.react_chat_messages OWNER TO root;

--
-- Name: react_chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: root
--

CREATE SEQUENCE public.react_chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.react_chat_messages_id_seq OWNER TO root;

--
-- Name: react_chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: root
--

ALTER SEQUENCE public.react_chat_messages_id_seq OWNED BY public.react_chat_messages.id;


--
-- Name: react_chat_sessions; Type: TABLE; Schema: public; Owner: root
--

CREATE TABLE public.react_chat_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    title text,
    trade_id integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    agent_type character varying(20) DEFAULT 'TRADER'::character varying,
    pending_limit_order_id bigint
);


ALTER TABLE public.react_chat_sessions OWNER TO root;

--
-- Name: user_memories; Type: TABLE; Schema: public; Owner: root
--

CREATE TABLE public.user_memories (
    id integer NOT NULL,
    user_id text NOT NULL,
    fact text NOT NULL,
    source text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_memories OWNER TO root;

--
-- Name: user_memories_id_seq; Type: SEQUENCE; Schema: public; Owner: root
--

CREATE SEQUENCE public.user_memories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_memories_id_seq OWNER TO root;

--
-- Name: user_memories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: root
--

ALTER SEQUENCE public.user_memories_id_seq OWNED BY public.user_memories.id;


--
-- Name: chat_history id; Type: DEFAULT; Schema: public; Owner: root
--

ALTER TABLE ONLY public.chat_history ALTER COLUMN id SET DEFAULT nextval('public.chat_history_id_seq'::regclass);


--
-- Name: chat_uploads id; Type: DEFAULT; Schema: public; Owner: root
--

ALTER TABLE ONLY public.chat_uploads ALTER COLUMN id SET DEFAULT nextval('public.chat_uploads_id_seq'::regclass);


--
-- Name: desktop_device_sessions id; Type: DEFAULT; Schema: public; Owner: root
--

ALTER TABLE ONLY public.desktop_device_sessions ALTER COLUMN id SET DEFAULT nextval('public.desktop_device_sessions_id_seq'::regclass);


--
-- Name: lang_ai_memory id; Type: DEFAULT; Schema: public; Owner: root
--

ALTER TABLE ONLY public.lang_ai_memory ALTER COLUMN id SET DEFAULT nextval('public.lang_ai_memory_id_seq'::regclass);


--
-- Name: react_chat_messages id; Type: DEFAULT; Schema: public; Owner: root
--

ALTER TABLE ONLY public.react_chat_messages ALTER COLUMN id SET DEFAULT nextval('public.react_chat_messages_id_seq'::regclass);


--
-- Name: user_memories id; Type: DEFAULT; Schema: public; Owner: root
--

ALTER TABLE ONLY public.user_memories ALTER COLUMN id SET DEFAULT nextval('public.user_memories_id_seq'::regclass);


--
-- Name: chat_history chat_history_chat_id_message_id_key; Type: CONSTRAINT; Schema: public; Owner: root
--

ALTER TABLE ONLY public.chat_history
    ADD CONSTRAINT chat_history_chat_id_message_id_key UNIQUE (chat_id, message_id);


--
-- Name: chat_history chat_history_pkey; Type: CONSTRAINT; Schema: public; Owner: root
--

ALTER TABLE ONLY public.chat_history
    ADD CONSTRAINT chat_history_pkey PRIMARY KEY (id);


--
-- Name: chat_uploads chat_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: root
--

ALTER TABLE ONLY public.chat_uploads
    ADD CONSTRAINT chat_uploads_pkey PRIMARY KEY (id);


--
-- Name: desktop_device_sessions desktop_device_sessions_pairing_code_key; Type: CONSTRAINT; Schema: public; Owner: root
--

ALTER TABLE ONLY public.desktop_device_sessions
    ADD CONSTRAINT desktop_device_sessions_pairing_code_key UNIQUE (pairing_code);


--
-- Name: desktop_device_sessions desktop_device_sessions_pairing_id_key; Type: CONSTRAINT; Schema: public; Owner: root
--

ALTER TABLE ONLY public.desktop_device_sessions
    ADD CONSTRAINT desktop_device_sessions_pairing_id_key UNIQUE (pairing_id);


--
-- Name: desktop_device_sessions desktop_device_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: root
--

ALTER TABLE ONLY public.desktop_device_sessions
    ADD CONSTRAINT desktop_device_sessions_pkey PRIMARY KEY (id);


--
-- Name: lang_ai_memory lang_ai_memory_pkey; Type: CONSTRAINT; Schema: public; Owner: root
--

ALTER TABLE ONLY public.lang_ai_memory
    ADD CONSTRAINT lang_ai_memory_pkey PRIMARY KEY (id);


--
-- Name: react_chat_messages react_chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: root
--

ALTER TABLE ONLY public.react_chat_messages
    ADD CONSTRAINT react_chat_messages_pkey PRIMARY KEY (id);


--
-- Name: react_chat_sessions react_chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: root
--

ALTER TABLE ONLY public.react_chat_sessions
    ADD CONSTRAINT react_chat_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_memories user_memories_pkey; Type: CONSTRAINT; Schema: public; Owner: root
--

ALTER TABLE ONLY public.user_memories
    ADD CONSTRAINT user_memories_pkey PRIMARY KEY (id);


--
-- Name: idx_desktop_device_sessions_expires_at; Type: INDEX; Schema: public; Owner: root
--

CREATE INDEX idx_desktop_device_sessions_expires_at ON public.desktop_device_sessions USING btree (expires_at DESC);


--
-- Name: idx_desktop_device_sessions_status; Type: INDEX; Schema: public; Owner: root
--

CREATE INDEX idx_desktop_device_sessions_status ON public.desktop_device_sessions USING btree (status);


--
-- Name: idx_desktop_device_sessions_user_id; Type: INDEX; Schema: public; Owner: root
--

CREATE INDEX idx_desktop_device_sessions_user_id ON public.desktop_device_sessions USING btree (user_id);


--
-- Name: idx_lang_ai_memory_session; Type: INDEX; Schema: public; Owner: root
--

CREATE INDEX idx_lang_ai_memory_session ON public.lang_ai_memory USING btree (session_id);


--
-- Name: idx_rcm_session; Type: INDEX; Schema: public; Owner: root
--

CREATE INDEX idx_rcm_session ON public.react_chat_messages USING btree (session_id);


--
-- Name: idx_rcs_trade; Type: INDEX; Schema: public; Owner: root
--

CREATE INDEX idx_rcs_trade ON public.react_chat_sessions USING btree (trade_id);


--
-- Name: idx_rcs_user; Type: INDEX; Schema: public; Owner: root
--

CREATE INDEX idx_rcs_user ON public.react_chat_sessions USING btree (user_id);


--
-- Name: idx_react_chat_sessions_pending_limit_order_id; Type: INDEX; Schema: public; Owner: root
--

CREATE INDEX idx_react_chat_sessions_pending_limit_order_id ON public.react_chat_sessions USING btree (pending_limit_order_id);


--
-- Name: idx_um_user; Type: INDEX; Schema: public; Owner: root
--

CREATE INDEX idx_um_user ON public.user_memories USING btree (user_id);


--
-- Name: idx_uploads_time; Type: INDEX; Schema: public; Owner: root
--

CREATE INDEX idx_uploads_time ON public.chat_uploads USING btree (chat_id, created_at);


--
-- Name: react_chat_messages react_chat_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: root
--

ALTER TABLE ONLY public.react_chat_messages
    ADD CONSTRAINT react_chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.react_chat_sessions(id) ON DELETE CASCADE;


--
-- Name: react_chat_sessions react_chat_sessions_pending_limit_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: root
--

ALTER TABLE ONLY public.react_chat_sessions
    ADD CONSTRAINT react_chat_sessions_pending_limit_order_id_fkey FOREIGN KEY (pending_limit_order_id) REFERENCES public.pending_limit_orders(id) ON DELETE SET NULL;


--
-- Name: react_chat_sessions react_chat_sessions_trade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: root
--

ALTER TABLE ONLY public.react_chat_sessions
    ADD CONSTRAINT react_chat_sessions_trade_id_fkey FOREIGN KEY (trade_id) REFERENCES public.trades_activos(id);


--
-- Name: react_chat_sessions react_chat_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: root
--

ALTER TABLE ONLY public.react_chat_sessions
    ADD CONSTRAINT react_chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."User"(id);


--
-- Name: user_memories user_memories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: root
--

ALTER TABLE ONLY public.user_memories
    ADD CONSTRAINT user_memories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."User"(id);


--
-- PostgreSQL database dump complete
--

\unrestrict pw8x1etYhWu4FeSMWYaQkapNib4XIQDaw0OKF2IZDnBdp0eOhMIdXo3ee6yP5pt

